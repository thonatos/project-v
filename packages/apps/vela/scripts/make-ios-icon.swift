// Renders Vela's iOS app icon: the same sails and accent as the macOS icon
// (`icon/AppIcon.icon`, whose `sails.svg` holds these scaled coordinates),
// full bleed and opaque, because iOS applies its own corner mask and rejects
// transparency. Output is exactly 1024 x 1024 px.
//
//   swift scripts/make-ios-icon.swift <output.png>
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let output = CommandLine.arguments[1]
let pixels = 1024
let space = CGColorSpace(name: CGColorSpace.sRGB)!

guard let context = CGContext(
  data: nil, width: pixels, height: pixels, bitsPerComponent: 8, bytesPerRow: 0,
  space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
) else {
  fatalError("could not create context")
}

// The macOS icon's warm accent (#A8491F), full bleed.
context.setFillColor(CGColor(srgbRed: 0xA8 / 255, green: 0x49 / 255, blue: 0x1F / 255, alpha: 1))
context.fill(CGRect(x: 0, y: 0, width: pixels, height: pixels))

// The sails on the icon's 1024 grid (y up), scaled to sit inside the mask.
let scale: CGFloat = 0.86
let offset = CGFloat(pixels) * (1 - scale) / 2
func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
  CGPoint(x: offset + x * scale, y: offset + y * scale)
}

func sail(_ a: CGPoint, _ b: CGPoint, _ c: CGPoint, alpha: CGFloat) {
  context.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: alpha))
  context.beginPath()
  context.move(to: a)
  context.addLine(to: b)
  context.addLine(to: c)
  context.closePath()
  context.fillPath()
}

sail(point(512, 805), point(250, 278), point(512, 380), alpha: 1)
sail(point(548, 752), point(548, 326), point(790, 278), alpha: 0.72)

guard let image = context.makeImage(),
      let destination = CGImageDestinationCreateWithURL(
        URL(fileURLWithPath: output) as CFURL, UTType.png.identifier as CFString, 1, nil
      ) else {
  fatalError("could not encode icon")
}
CGImageDestinationAddImage(destination, image, nil)
guard CGImageDestinationFinalize(destination) else {
  fatalError("could not write icon")
}
