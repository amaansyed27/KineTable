import type { Definition } from "../schema.js";
export const physical: readonly Definition[] = [
  { id:"breadboard-half-400", name:"400-hole breadboard", description:"Solderless breadboard with isolated A–E and F–J strips and four continuous power rails.", kind:"breadboard", category:"breadboard", aliases:["half breadboard", "solderless breadboard"], supportedVariant:"Kinetable 400-hole topology with continuous rails", verification:"profiled", limitations:"Physical breadboard rails and row numbering can vary; inspect your actual board.", sources:[], visualId:"breadboard", asset:{kind:"procedural",id:"breadboard",license:"Kinetable original"}, electricalModel:"breadboard", pins:[], simulation:"topology-dependent" },
];
