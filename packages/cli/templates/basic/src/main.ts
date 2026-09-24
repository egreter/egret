import {
  Bitmap,
  Container,
  Rect,
  TextField,
  createApplication
} from "@egreter/engine";

const app = createApplication({
  canvas: "#game",
  width: 750,
  height: 1334,
  frameRate: 60,
  background: "#111827"
});

const content = new Container();
content.width = 750;
content.height = 1334;
app.stage.addChild(content);

const title = new TextField("Egreter", {
  color: "#f9fafb",
  fontSize: 72,
  fontWeight: "700"
});
title.x = 214;
title.y = 250;
content.addChild(title);

const subtitle = new TextField("modern create → dev → build", {
  color: "#94a3b8",
  fontSize: 26
});
subtitle.x = 178;
subtitle.y = 350;
content.addChild(subtitle);

const logo = await Bitmap.fromUrl("/egreter.svg");
logo.x = 315;
logo.y = 450;
logo.scaleX = 0.5;
logo.scaleY = 0.5;
content.addChild(logo);

const button = new Rect(330, 92, "#4f46e5");
button.x = 210;
button.y = 700;
content.addChild(button);

const buttonLabel = new TextField("Tap / click me", {
  color: "#ffffff",
  fontSize: 30,
  fontWeight: "600"
});
buttonLabel.x = 272;
buttonLabel.y = 726;
buttonLabel.pointerEnabled = false;
content.addChild(buttonLabel);

const status = new TextField("Asset loaded. Pointer input ready.", {
  color: "#a7f3d0",
  fontSize: 24
});
status.x = 174;
status.y = 850;
content.addChild(status);

button.on("pointerdown", () => {
  button.color = "#059669";
  status.setText("Pointer input works. Egreter is running.");
});

button.on("pointerup", () => {
  button.color = "#4f46e5";
});
