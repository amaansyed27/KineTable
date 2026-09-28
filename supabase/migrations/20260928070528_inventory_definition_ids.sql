-- Keep this identity allowlist aligned with component-library/catalog.ts when adding a reviewed definition.
alter table public.inventory_items add constraint inventory_known_definition check (definition_id in (
  'esp32-dev-module', 'raspberry-pi-pico', 'arduino-uno',
  'led-5mm', 'resistor-220r', 'push-button', 'grove-buzzer-v1-1',
  'hc-sr501', 'oled-ssd1306-i2c-3v3', 'dht11-module', 'breadboard-half-400'
));
