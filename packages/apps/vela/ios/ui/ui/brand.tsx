/**
 * The Vela mark: the two sails of the app icon (`scripts/make-icon.swift`),
 * drawn in the accent color, beside the wordmark.
 */
import { Canvas, Text, View } from 'nsh';
import { resolve } from './native';
import { font, ink, inset, symbol } from './tokens';

/** The two sails, scaled from the icon's 1024 grid into `size` points. */
export function SailMark(props: { size?: number }) {
  const size = () => props.size ?? symbol.brand;
  return (
    <Canvas
      style={{ width: size(), height: size() }}
      accessibilityElementsHidden
      draw={(cx, area) => {
        const s = area.width / 1024;
        // The icon's y axis points up (AppKit); the canvas's points down.
        const point = (x: number, y: number): [number, number] => [x * s, (1024 - y) * s];
        cx.fillStyle = resolve('accent');
        cx.beginPath();
        cx.moveTo(...point(512, 805));
        cx.lineTo(...point(250, 278));
        cx.lineTo(...point(512, 380));
        cx.closePath();
        cx.fill();
        cx.globalAlpha = 0.6;
        cx.beginPath();
        cx.moveTo(...point(548, 752));
        cx.lineTo(...point(548, 326));
        cx.lineTo(...point(790, 278));
        cx.closePath();
        cx.fill();
        cx.globalAlpha = 1;
      }}
    />
  );
}

/** Sails and the name, for the home bar. */
export function Wordmark() {
  return (
    <View class={`flex-row items-center ${inset.tight}`} role="header" accessibilityLabel="Vela">
      <SailMark />
      <Text class={`${font.brand} ${ink.primary}`}>Vela</Text>
    </View>
  );
}
