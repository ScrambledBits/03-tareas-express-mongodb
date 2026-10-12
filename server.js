import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';

const PORT = Number(process.env.PORT ?? 3000);
const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME ?? 'tareas_db';

const cliente = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 5000 });
const app = express();

app.use(express.json());
app.use(express.static('public'));

function aObjectId(id) {
  return ObjectId.isValid(id) ? new ObjectId(id) : null;
}

app.get('/health', async (_req, res) => {
  try {
    await cliente.db(DB_NAME).command({ ping: 1 });
    res.json({ estado: 'ok', mongo: 'conectado' });
  } catch {
    res.status(503).json({ estado: 'error', mongo: 'sin conexion' });
  }
});

app.get('/api/tareas', async (_req, res) => {
  const tareas = await app.locals.tareas.find().sort({ creadaEn: -1 }).toArray();
  res.json(tareas);
});

app.post('/api/tareas', async (req, res) => {
  const titulo = String(req.body?.titulo ?? '').trim();
  if (!titulo) {
    return res.status(400).json({ error: 'El campo "titulo" es obligatorio' });
  }
  const tarea = { titulo, completada: false, creadaEn: new Date() };
  const { insertedId } = await app.locals.tareas.insertOne(tarea);
  res.status(201).json({ _id: insertedId, ...tarea });
});

app.patch('/api/tareas/:id', async (req, res) => {
  const _id = aObjectId(req.params.id);
  if (!_id || typeof req.body?.completada !== 'boolean') {
    return res.status(400).json({ error: 'ID invalido o falta "completada" (booleano)' });
  }
  const tarea = await app.locals.tareas.findOneAndUpdate(
    { _id },
    { $set: { completada: req.body.completada } },
    { returnDocument: 'after' },
  );
  if (!tarea) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.json(tarea);
});

app.delete('/api/tareas/:id', async (req, res) => {
  const _id = aObjectId(req.params.id);
  const { deletedCount } = _id ? await app.locals.tareas.deleteOne({ _id }) : { deletedCount: 0 };
  if (!deletedCount) return res.status(404).json({ error: 'Tarea no encontrada' });
  res.status(204).end();
});

try {
  await cliente.connect();
  app.locals.tareas = cliente.db(DB_NAME).collection('tareas');
  console.log(`Conectado a MongoDB (base de datos "${DB_NAME}")`);
} catch (err) {
  console.error(`No se pudo conectar a MongoDB en ${MONGO_URL}: ${err.message}`);
  process.exit(1);
}

const servidor = app.listen(PORT, () => console.log(`API de tareas escuchando en el puerto ${PORT}`));

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    console.log(`Recibida ${senal}, cerrando...`);
    servidor.close(async () => {
      await cliente.close();
      process.exit(0);
    });
  });
}
