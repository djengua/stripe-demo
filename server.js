require("dotenv").config();
const express = require("express");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const cors = require("cors");
// const router = express.Router();

const PAYPAL_CLIENT_ID = "ATa4bU8PEiJ98nLxKli2Pl5vb5bF7yR-SRtZ789FX_-HqcJS0JEsAE2E2ayvtTvy_Tnavg9JcStcRQiY";
const PAYPAL_CLIENT_SECRET = "ATa4bU8PEiJ98nLxKli2Pl5vb5bF7yR-SRtZ789FX_-HqcJS0JEsAE2E2ayvtTvy_Tnavg9JcStcRQiY";
const PAYPAL_API_BASE = "https://api-m.sandbox.paypal.com";

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // Para procesar JSON en el cuerpo de las solicitudes

async function getPayPalAccessToken() {
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: "grant_type=client_credentials",
  });

  const data = await response.json();
  return data.access_token;
}

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.get("/create-payment-intent", (req, res) => {
  res.status(405).json({ error: "Este endpoint requiere una solicitud POST" });
});

// Ruta para crear un Payment Intent
app.post("/create-payment-intent", async (req, res) => {
  try {
    console.log('yyy');
    const { amount, currency, description, customer: cust } = req.body;

    console.log(amount, currency, description );

    // Validar entrada
    if (!amount || !currency) {
      return res.status(400).json({
        error: "Se requieren los campos amount y currency",
      });
    }

    const customer = await stripe.customers.create({ description: cust.id, name: cust.name });
    const ephemeralKey = await stripe.ephemeralKeys.create(
      { customer: customer.id },
      { apiVersion: '2025-02-24.acacia' }
    );

    // Crear el Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customer.id,
      description,
      automatic_payment_methods: {
        enabled: true,
      }
    });

    console.log(paymentIntent);

    res.status(200).json({
        paymentIntent: paymentIntent.client_secret,
        ephemeralKey: ephemeralKey.secret,
        customer: customer.id,
        publishableKey: 'pk_test_51R5Z0pC4OhSGzK4Pgk4KZ4ZLrrhUiP7mpcAuRATE3CqilHbrIlHZuQZqE7a8Ak3A8SqwhlNviOA9j1af8U2yhdc500dg3IGVSO'
      });

    //// Devolver el client_secret al cliente
    // res.status(200).json({
    //   clientSecret: paymentIntent.client_secret,
    //   id: paymentIntent.id,
    // });
  } catch (error) {
    console.error("Error al crear Payment Intent:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/create-payment', async (req, res) => {
  try {
    //const customer = await stripe.customers.create();
    //const ephemeralKey = await stripe.ephemeralKeys.create(
    //  {customer: customer.id},
    //  {apiVersion: '2025-02-24.acacia'}
    //);
    const { amount, currency } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency,
      payment_method_types: ['card'],
    });

    res.json({
      clientSecret: paymentIntent.client_secret
    });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
});

app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
  
    try {
      // Verificar la firma del webhook con el secreto del webhook
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_SECRET_KEY
      );
    } catch (err) {
      console.log('Error de firma del webhook:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  
    // Manejar el evento
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('PaymentIntent exitoso:', paymentIntent.id);
        // Aquí puedes actualizar tu base de datos o enviar confirmaciones
        break;
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('Pago fallido:', failedPayment.id, failedPayment.last_payment_error?.message);
        break;
      default:
        console.log(`Evento no manejado: ${event.type}`);
    }
  
    // Retornar una respuesta para confirmar la recepción
    res.status(200).json({ received: true });
  });

// Ruta de prueba para verificar que el servidor funciona
app.get("/", (req, res) => {
  res.send("API de pagos con Stripe funcionando");
});

// router.post("/create-paypal-order", async (req, res) => {
//   try {
//     const { amount, currency = "MXN" } = req.body;

//     // Validar campos
//     if (!amount) {
//       return res.status(400).json({ error: "Se requiere el campo amount" });
//     }

//     const accessToken = await getPayPalAccessToken();

//     const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         Authorization: `Bearer ${accessToken}`,
//       },
//       body: JSON.stringify({
//         intent: "CAPTURE",
//         purchase_units: [
//           {
//             amount: {
//               currency_code: currency,
//               value: (amount / 100).toFixed(2), // Convertir de centavos a unidades
//             },
//             description: "Pago de trámite en GTO",
//           },
//         ],
//         application_context: {
//           brand_name: "Gobierno de Guanajuato",
//           return_url: "https://example.com/return",
//           cancel_url: "https://example.com/cancel",
//         },
//       }),
//     });

//     const data = await response.json();

//     if (data.error) {
//       console.error("Error de PayPal:", data.error);
//       return res.status(500).json({ error: data.error });
//     }

//     res.json({ orderId: data.id });
//   } catch (error) {
//     console.error("Error al crear orden de PayPal:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // Capturar una orden de PayPal (finalizar el pago)
// router.post("/capture-paypal-order", async (req, res) => {
//   try {
//     const { orderId } = req.body;

//     if (!orderId) {
//       return res.status(400).json({ error: "Se requiere el orderId" });
//     }

//     const accessToken = await getPayPalAccessToken();

//     const response = await fetch(
//       `${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`,
//       {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//           Authorization: `Bearer ${accessToken}`,
//         },
//       }
//     );

//     const data = await response.json();

//     // Verificar estado del pago
//     if (data.status === "COMPLETED") {
//       // Aquí podrías guardar el pago en tu base de datos
//       res.json({
//         success: true,
//         transaction_id: data.purchase_units[0].payments.captures[0].id,
//       });
//     } else {
//       res
//         .status(400)
//         .json({ error: "Pago no completado", status: data.status });
//     }
//   } catch (error) {
//     console.error("Error al capturar orden de PayPal:", error);
//     res.status(500).json({ error: error.message });
//   }
// });

// // Rutas para el flujo de redirección del WebView
// router.get("/paypal-success", (req, res) => {
//   res.send(`
//         <html>
//         <body>
//             <script>
//             window.onload = function() {
//                 // Mensaje para la app
//                 window.location.href = '/paypal-success';
//             }
//             </script>
//         </body>
//         </html>
//     `);
// });

// router.get("/paypal-cancel", (req, res) => {
//   res.send(`
//         <html>
//         <body>
//             <script>
//             window.onload = function() {
//                 window.location.href = '/paypal-cancel';
//             }
//             </script>
//         </body>
//         </html>
//     `);
// });

// router.get("/paypal-error", (req, res) => {
//   res.send(`
//         <html>
//         <body>
//             <script>
//             window.onload = function() {
//                 window.location.href = '/paypal-error';
//             }
//             </script>
//         </body>
//         </html>
//     `);
// });

// Iniciar el servidor
app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${port}`);
});
