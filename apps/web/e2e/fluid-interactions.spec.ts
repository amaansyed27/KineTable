import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

test("board choice stays clear, primary hover stays readable, and navigation can be interrupted", async ({page}) => {
  mkdirSync("../../output/playwright/fluid", {recursive:true});
  for(const theme of ["light", "dark"] as const) {
    await page.emulateMedia({colorScheme:theme});
    for(const width of [1440,390]) {
      await page.setViewportSize({width,height:900});await page.goto("/start");
      for(const name of ["ESP32","Raspberry Pi Pico","Arduino Uno"]) {
        await page.getByRole("radio",{name,exact:true}).check();
        const selected=page.locator('.board-option[data-selected=true]');
        await expect(selected.locator(".board-selection-mark")).toHaveCount(1);
        expect(await selected.evaluate(el=>getComputedStyle(el).backgroundImage)).toBe("none");
        const button=page.getByRole("button",{name:`Continue with ${name}`,exact:true});
        await button.hover();await page.waitForTimeout(280);
        const contrast=await button.evaluate(el=>{
          const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d")!;
          function luminance(color:string) { ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const rgb=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722; }
          const style=getComputedStyle(el),label=getComputedStyle(el.querySelector(".button-label")!),a=luminance(label.color),b=luminance(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
        if(name==="Raspberry Pi Pico") await page.screenshot({path:`../../output/playwright/fluid/board-${theme}-${width}.png`,fullPage:true});
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  }
  await page.emulateMedia({reducedMotion:"reduce"});await page.getByRole("radio",{name:"ESP32",exact:true}).focus();await page.keyboard.press("Space");
  await expect(page.getByRole("radio",{name:"ESP32",exact:true})).toBeChecked();
  await page.getByRole("button",{name:"Continue with ESP32",exact:true}).click();await expect(page).toHaveURL(/\/home$/);
  await page.getByRole("link",{name:"Appearance",exact:true}).click();await expect(page.getByRole("heading",{name:"Appearance",exact:true})).toBeVisible();
  await page.emulateMedia({reducedMotion:"no-preference"});
  await page.getByRole("navigation",{name:"Settings"}).getByRole("link",{name:"Account",exact:true}).click();
  await page.getByRole("navigation",{name:"Settings"}).getByRole("link",{name:"AI providers",exact:true}).click();
  await expect(page.getByRole("heading",{name:"AI providers",exact:true})).toBeVisible();
  await page.getByRole("link",{name:"Projects",exact:true}).click();await expect(page.getByRole("heading",{name:"Projects",exact:true})).toBeVisible();
});
