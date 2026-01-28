const axios = require("axios");
const util = require("util");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");
const Payment = require("../models/Payment");
const ProductModel = require("../models/Product");

const getCourseInitIdParam = () => {
  try {
    require.resolve("./../course_init_id");
    const { courseInitId } = require("../course_init_id");
    console.log("Loaded courseInitId:", courseInitId);
    return courseInitId ? `${courseInitId}` : "";
  } catch (error) {
    return "";
  }
};

exports.generateQrCode = async (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) {
    return res.redirect("/nets-qr/fail");
  }

  const TAX_RATE = 0.07;
  const SHIPPING_FLAT = 5.0;
  const subtotal = cart.reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
    0
  );
  const tax = subtotal * TAX_RATE;
  const shipping = cart.length ? SHIPPING_FLAT : 0;
  const total = subtotal + tax + shipping;

  const cartTotal = Number(total).toFixed(2);
  console.log("NETS cart total:", cartTotal);
  try {
    const requestBody = {
      txn_id: "sandbox_nets|m|8ff8e5b6-d43e-4786-8ac5-7accf8c5bd9b", // Default for testing
      amt_in_dollars: cartTotal,
      notify_mobile: 0,
    };

    const response = await axios.post(
      `https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/request`,
      requestBody,
      {
        headers: {
          "api-key": process.env.API_KEY,
          "project-id": process.env.PROJECT_ID,
        },
      }
    );

    const qrData = response.data.result.data;
    console.log({ qrData });

    if (
      qrData.response_code === "00" &&
      qrData.txn_status === 1 &&
      qrData.qr_code
    ) {
      console.log("QR code generated successfully");

      // Store transaction retrieval reference for later use
      const txnRetrievalRef = qrData.txn_retrieval_ref;
      const courseInitId = getCourseInitIdParam();

      // Create a local pending order + payment for NETS
      const user = req.session.user;
      if (!user) {
        return res.redirect("/login");
      }

      const createOrder = util.promisify(Order.create);
      const createPayment = util.promisify(Payment.create);
      const orderResult = await createOrder(user.id, total, "nets", "PENDING");
      const localOrderId = orderResult.insertId;

      await createPayment(
        localOrderId,
        user.id,
        "nets",
        total,
        "SGD",
        "CREATED",
        user.email,
        txnRetrievalRef
      );

      req.session.pendingNetsOrderId = localOrderId;
      req.session.netsOrderFinalized = false;
      req.session.lastNetsOrderId = null;

      const webhookUrl = `https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets/webhook?txn_retrieval_ref=${txnRetrievalRef}&course_init_id=${courseInitId}`;

      console.log("Transaction retrieval ref:" + txnRetrievalRef);
      console.log("courseInitId:" + courseInitId);
      console.log("webhookUrl:" + webhookUrl);

      
      // Render the QR code page with required data
      res.render("netsQr", {
        total: cartTotal,
        title: "Scan to Pay",
        qrCodeUrl: `data:image/png;base64,${qrData.qr_code}`,
        txnRetrievalRef: txnRetrievalRef,
        courseInitId: courseInitId,
        networkCode: qrData.network_status,
        timer: 300, // Timer in seconds
        webhookUrl: webhookUrl,
        fullNetsResponse: response.data,
        apiKey: process.env.API_KEY,
        projectId: process.env.PROJECT_ID,
      });
    } else {
      // Handle partial or failed responses
      let errorMsg = "An error occurred while generating the QR code.";
      if (qrData.network_status !== 0) {
        errorMsg =
          qrData.error_message || "Transaction failed. Please try again.";
      }
      res.render("netsQrFail", {
        title: "Error",
        responseCode: qrData.response_code || "N.A.",
        instructions: qrData.instruction || "",
        errorMsg: errorMsg,
      });
    }
  } catch (error) {
    console.error("Error in generateQrCode:", error.message);
    res.redirect("/nets-qr/fail");
  }
};

exports.checkQrStatus = async (req, res) => {
  const { txnRetrievalRef, courseInitId } = req.query;
  if (!txnRetrievalRef) {
    return res.status(400).json({ ok: false, error: "Missing txnRetrievalRef" });
  }

  try {
    const courseInitIdParam = courseInitId || getCourseInitIdParam();
    const statusUrl = `https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets/webhook?txn_retrieval_ref=${txnRetrievalRef}&course_init_id=${courseInitIdParam}`;

    const response = await axios.get(statusUrl, {
      headers: {
        "api-key": process.env.API_KEY,
        "project-id": process.env.PROJECT_ID,
      },
    });

    const statusPayload = response.data || {};
    const result =
      statusPayload.result && statusPayload.result.data
        ? statusPayload.result.data
        : statusPayload.result || statusPayload;

    const responseCode = result.response_code || result.responseCode;
    const txnStatus = result.txn_status || result.txnStatus || result.status;

    const isPaid =
      responseCode === "00" &&
      (txnStatus === 1 || txnStatus === "1" || txnStatus === "SUCCESS");

    let finalizedOrderId = null;
    const localOrderId = req.session.pendingNetsOrderId;

    if (isPaid) {
      if (localOrderId && !req.session.netsOrderFinalized) {
        try {
          const cart = req.session.cart || [];
          const user = req.session.user;

          if (cart.length && user) {
            const getById = util.promisify(ProductModel.getById);
            const createItem = util.promisify(OrderItem.create);
            const decrement = util.promisify(ProductModel.decrementQuantity);
            const updateOrderStatus = util.promisify(Order.updateStatus);
            const updatePayment = util.promisify(Payment.updateByOrder);

            for (const it of cart) {
              const rows = await getById(it.productId);
              const prod = rows && rows[0];
              if (!prod || Number(prod.quantity) < Number(it.quantity)) {
                await updatePayment(localOrderId, { status: "FAILED" });
                return res
                  .status(400)
                  .json({ ok: false, error: `Insufficient stock for ${it.productName}.` });
              }
            }

            for (const it of cart) {
              await createItem(localOrderId, it.productId, it.quantity, it.price);
              await decrement(it.productId, it.quantity);
            }

            await updateOrderStatus(localOrderId, "PAID");

            const providerRef =
              result.rrn || result.acq_txn_ref || result.txn_retrieval_ref || txnRetrievalRef;

            await updatePayment(localOrderId, {
              status: "COMPLETED",
              providerRef,
            });

            req.session.cart = [];
            req.session.pendingNetsOrderId = null;
            req.session.netsOrderFinalized = true;
            finalizedOrderId = localOrderId;
          }
        } catch (finalizeErr) {
          console.error("Error finalizing NETS order:", finalizeErr.message);
        }
      } else if (req.session.netsOrderFinalized) {
        finalizedOrderId = req.session.lastNetsOrderId || null;
      }
    }

    if (finalizedOrderId) {
      req.session.lastNetsOrderId = finalizedOrderId;
    }

    return res.json({
      ok: true,
      status: response.data,
      paid: isPaid,
      orderId: finalizedOrderId,
    });
  } catch (error) {
    console.error("Error in checkQrStatus:", error.message);
    return res.status(500).json({ ok: false, error: "Status check failed" });
  }
};
