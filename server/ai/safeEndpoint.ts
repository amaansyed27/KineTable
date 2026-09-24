import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";

export async function validateRemoteEndpoint(value: string): Promise<{ url: URL; address: string; family: 4 | 6 }> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("INVALID_ENDPOINT"); }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash || value.length > 300 || !["", "443", "8443"].includes(url.port) ||
    !/^[a-z0-9.-]+$/i.test(url.hostname) || !url.hostname.includes(".") || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(url.hostname) || ipaddr.isValid(url.hostname)) throw new Error("INVALID_ENDPOINT");
  let answers: { address: string; family: number }[];
  try { answers = await lookup(url.hostname, { all: true }); } catch { throw new Error("NETWORK_FAILURE"); }
  if (!answers.length || answers.some(answer => ipaddr.parse(answer.address).range() !== "unicast")) throw new Error("INVALID_ENDPOINT");
  return { url, address: answers[0].address, family: answers[0].family as 4 | 6 };
}
export async function pinnedJsonPost(baseUrl: string, path: string, body: unknown, secret: string, authMode: "bearer" | "x-api-key" | "none" = "bearer"): Promise<{ status: number; data: unknown }> {
  const target = await validateRemoteEndpoint(baseUrl);
  const endpoint = new URL(`${target.url.pathname.replace(/\/$/, "")}/${path.replace(/^\//, "")}`, target.url);
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = request(endpoint, { method: "POST", timeout: 30000, headers: { "Content-Type": "application/json", ...(authMode === "bearer" ? { Authorization: `Bearer ${secret}` } : authMode === "x-api-key" ? { "x-api-key": secret } : {}), "Content-Length": Buffer.byteLength(payload) },
      lookup: (_host, _options, callback) => callback(null, target.address, target.family) }, res => {
      let text = "";
      res.on("data", chunk => { text += chunk.toString(); if (text.length > 65536) req.destroy(new Error("PROVIDER_UNAVAILABLE")); });
      res.on("end", () => { try { resolve({ status: res.statusCode ?? 503, data: JSON.parse(text) as unknown }); } catch { reject(new Error("INVALID_MODEL_RESPONSE")); } });
    });
    req.on("timeout", () => req.destroy(new Error("TIMEOUT")));
    req.on("error", error => reject(new Error(error.message === "TIMEOUT" ? "TIMEOUT" : "NETWORK_FAILURE")));
    req.end(payload);
  });
}
export async function pinnedJsonGet(baseUrl: string, path: string, secret: string, authMode: "bearer" | "x-api-key" | "none" = "bearer"): Promise<{ status: number; data: unknown }> {
  const target = await validateRemoteEndpoint(baseUrl);
  const endpoint = new URL(`${target.url.pathname.replace(/\/$/, "")}/${path.replace(/^\//, "")}`, target.url);
  return new Promise((resolve, reject) => {
    const req = request(endpoint, { method: "GET", timeout: 10000, headers: authMode === "bearer" ? { Authorization: `Bearer ${secret}` } : authMode === "x-api-key" ? { "x-api-key": secret } : {},
      lookup: (_host, _options, callback) => callback(null, target.address, target.family) }, res => {
      let text = "";
      res.on("data", chunk => { text += chunk.toString(); if (text.length > 65536) req.destroy(new Error("PROVIDER_UNAVAILABLE")); });
      res.on("end", () => { try { resolve({ status: res.statusCode ?? 503, data: JSON.parse(text) as unknown }); } catch { reject(new Error("INVALID_MODEL_RESPONSE")); } });
    });
    req.on("timeout", () => req.destroy(new Error("TIMEOUT")));
    req.on("error", error => reject(new Error(error.message === "TIMEOUT" ? "TIMEOUT" : "NETWORK_FAILURE")));
    req.end();
  });
}
