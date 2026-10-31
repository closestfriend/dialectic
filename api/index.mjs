import { createApp } from '../app/server.mjs';

// Vercel invokes this function directly; the Node server remains the shared
// request handler for local development and serverless execution.
const app=createApp();

export default function handler(req,res) {
  app.emit('request',req,res);
}
