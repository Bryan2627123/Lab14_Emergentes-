const WebSocket = require('ws');
const mongoose = require('mongoose');

// Conectar a MongoDB
mongoose.connect('mongodb+srv://esp32_user:esp32_pass@esp32-cluster.jpn19.mongodb.net/tu_base_de_datos', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('Conectado a MongoDB');
})
.catch((err) => {
    console.error('Error de conexión a MongoDB:', err);
});

// POTENCIOMETRO: Esquema y Modelo
const potSchema = new mongoose.Schema({
    value: Number,
    timestamp: { type: Date, default: Date.now },
});
const Potenciometro = mongoose.model('Potenciometro', potSchema);

// LED: Esquema y Modelo
const ledSchema = new mongoose.Schema({
    estado: String,  // "ON" o "OFF"
    timestamp: { type: Date, default: Date.now },
});
const Led = mongoose.model('Led', ledSchema);

const wss = new WebSocket.Server({ port: 8080 });

let esp32Socket = null;

wss.on('connection', (ws) => {
    console.log('Nuevo cliente conectado');

    ws.on('message', async (message) => {  // Añadimos `async` aquí
        message = String(message);
        console.log(`Mensaje recibido: ${message}`);

        if (message === 'ESP32') {
            esp32Socket = ws;
            console.log('ESP32 conectado');
        } else if (message === 'ON' || message === 'OFF' || message === 'GET_POT') {
            if (esp32Socket) {
                esp32Socket.send(message);
                console.log(`Comando enviado al ESP32: ${message}`);
                
                if (message === 'ON' || message === 'OFF') {
                    const nuevoEstadoLED = new Led({ estado: message });
                    await nuevoEstadoLED.save();  // Guardamos en la DB
                    console.log(`Estado del LED guardado en DB: ${message}`);
                }
            } else {
                console.log('ESP32 no está conectado');
            }
        } else if (message.startsWith('POT:')) {
            const potValue = parseInt(message.split(':')[1], 10);
            const nuevaLectura = new Potenciometro({ value: potValue });
            await nuevaLectura.save();  // Guardamos en MongoDB
            console.log(`Valor del potenciómetro guardado en DB: ${potValue}`);

            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(`POT:${potValue}`);
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('Cliente desconectado');
        if (ws === esp32Socket) {
            esp32Socket = null;
            console.log('ESP32 desconectado');
        }
    });
});

console.log('Servidor WebSockets escuchando en http://localhost:8080');


