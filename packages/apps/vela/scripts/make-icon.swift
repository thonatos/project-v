import AppKit

let output = CommandLine.arguments[1]
let size = NSSize(width: 1024, height: 1024)
let image = NSImage(size: size)
image.lockFocus()

let background = NSBezierPath(roundedRect: NSRect(x: 32, y: 32, width: 960, height: 960), xRadius: 220, yRadius: 220)
NSColor(calibratedRed: 0.063, green: 0.463, blue: 0.435, alpha: 1).setFill()
background.fill()

let sail = NSBezierPath()
sail.move(to: NSPoint(x: 512, y: 805))
sail.line(to: NSPoint(x: 250, y: 278))
sail.line(to: NSPoint(x: 512, y: 380))
sail.close()
NSColor.white.setFill()
sail.fill()

let second = NSBezierPath()
second.move(to: NSPoint(x: 548, y: 752))
second.line(to: NSPoint(x: 548, y: 326))
second.line(to: NSPoint(x: 790, y: 278))
second.close()
NSColor(calibratedWhite: 1, alpha: 0.72).setFill()
second.fill()

image.unlockFocus()
guard let data = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: data),
      let png = bitmap.representation(using: .png, properties: [:]) else {
  fatalError("could not render icon")
}
try png.write(to: URL(fileURLWithPath: output))
