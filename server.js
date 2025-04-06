require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { handleIncomingMessage } = require('./controllers/botController');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// Webhook de WhatsApp
app.post('/webhook', handleIncomingMessage);

// Iniciar el servidor
app.listen(3000, () => console.log('🚀 Servidor WhatsApp corriendo en http://localhost:3000'));
