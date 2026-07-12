# FanPass Turnstile Enclosure Spec

This document is for the local Arduino/EP8280 bench turnstile enclosure only. It is not iOS, Ops release, school-web, TestFlight, or production gate evidence.

## Scope

The first printable enclosure should tidy the current bench build and protect the parts while keeping every connector serviceable. It should hold:

- Arduino UNO R4 WiFi controller.
- EP8280 NFC/QR scan engine.
- 16x2 I2C LCD.
- HC-SR04 ultrasonic pass-through sensor.
- One SG90-class micro servo gate actuator.
- External regulated 5V rail for scanner/servo stability, plus Arduino USB-C or DC input access.

## Source Dimensions

All dimensions are in millimeters.

| Part | Confirmed / reference size | Enclosure allowance | Notes |
| --- | ---: | ---: | --- |
| Arduino UNO R4 WiFi | 68.58 x 53.34 board outline | 72 x 57 tray, 16+ height clearance | Official mechanical drawing shows 68.58 x 53.34, max top component height around 8.5. Leave USB-C and DC jack edge access. |
| EP8280 NFC/QR engine | Front envelope 64.8 x 61, depth 26 | 68 x 65 pocket, 50+ rear depth including cable bend | Integration drawing shows 4 x 3.5 mm mounting holes, 58 mm horizontal outer mount span, 44 mm vertical inner mount span, 51 mm optical inner width, rear connector panel around 43.1 mm. |
| EP8280 clear window | Optical window as close as possible to scanner front, a = 0 | 55 x 55 clear aperture, 58 x 58 recessed lens pocket | Window material 0.8-2.0 thick PMMA/optical glass, >92% transmittance, <1% haze. Interior around scanner should be matte black. |
| EP8280 8-pin harness | 8-pin box connector, 2.0 pitch | Rear cable slot at least 45 x 14, plus 20 bend depth | Current sketch uses the 8-pin path for power, TTL, Wiegand diagnostics, LED/decode, and trigger. Do not bury this connector. |
| EP8280 12-pin FPC | 12-pin FPC, 1.2 pitch | Optional internal service clearance only | Not the current bench path. If used later, power must be off before connect/disconnect. |
| HC-SR04 ultrasonic | 45 x 20 x 15 module, 4-pin 2.54 header | 49 x 24 pocket, two 18 mm front holes | Module family varies. Use 18 mm holes for the two transducers and verify actual center spacing before printing the front panel. |
| 16x2 I2C LCD | 80 x 36 x 20 module | 84 x 40 rear pocket, 72 x 25 display window | The current sketch finds a 16x2 LCD at 0x27. Mounting holes and backpack depth vary; verify the exact module before adding screw bosses. |
| SG90-class servo | TowerPro SG90 digital: 23 x 12.2 x 29 body | 26 x 15 x 32 pocket, side shaft clearance | Product table also lists flange dimensions A 30.3, B 22.7, E 32.3, F 17. Confirm the exact servo if it is not a real SG90. |
| Servo arm / barrier | Depends on chosen horn/arm | 5-8 wide side slot, 2 mm radial clearance | Keep arm external so it can be replaced without opening the electronics bay. |
| Power input | Arduino USB-C 5V or barrel/VIN 6-24V; servo external 4.8-6V preferred | USB-C slot around 12 x 8, DC/power grommet around 12-14 diameter | Do not power servo from a GPIO. Keep servo/scanner on a stable regulated 5V supply with common ground. |

## Proposed V1 Enclosure

Recommended first print: two-piece rectangular kiosk box, rear service lid, front scanner/display face, and side-mounted servo.

- Outer starting envelope: 180 W x 145 H x 80 D.
- Wall thickness: 3.0.
- Rear lid overlap: 6.0 lip, M3 screws or heat-set inserts.
- Internal floor: Arduino tray on 6-8 mm M3 standoffs.
- Scanner bay: EP8280 mounted behind the front face, centered in a raised matte-black bezel.
- LCD bay: above or beside the scanner, with only the display visible from outside.
- Ultrasonic bay: lower front/side, facing the pass-through area, not the QR target area.
- Servo bay: right side or top side, with only shaft/horn exiting the case.
- Cable bay: rear bottom gutter for EP8280 harness, LCD I2C cable, HC-SR04 4-wire cable, servo 3-wire cable, and power.

## Front Cutouts

Use these as CAD starter values, then adjust after physical measurement.

| Cutout | Starter size | Placement / purpose |
| --- | ---: | --- |
| EP8280 optical window | 55 x 55 clear opening | Centered on scanner lens/LED area. Add a recessed 58 x 58 pocket for 0.8-2.0 PMMA or glass if using a protective sheet. |
| EP8280 mounting holes | 4 x 3.7 printed holes for M3/M3.5 clearance | Match EP8280 drawing: four 3.5 mm module holes on side tabs. Printed holes should be slightly oversized or drilled after print. |
| LCD display window | 72 x 25 | Exposes display, not the whole PCB. Keep contrast potentiometer/backpack reachable from rear. |
| HC-SR04 transducers | 2 x 18 circular holes | Confirm transducer center spacing on the actual module before final print. Add a 49 x 24 rear pocket. |
| Status / reset service | Optional 6-8 access hole | Only if the Arduino reset button or a manual service button must be accessible without opening the rear lid. |

## Side / Rear Cutouts

| Cutout | Starter size | Reason |
| --- | ---: | --- |
| Arduino USB-C | 12 x 8 | Programming and USB power access. Align to the board edge after choosing Arduino orientation. |
| DC / external 5V input | 12-14 round grommet or 16 x 10 slot | Separate regulated 5V feed for EP8280/servo is recommended. |
| EP8280 rear harness | 45 x 14 internal slot, 20 cable bend depth | The module has rear connectors; do not force Dupont/FPC cables against the rear wall. |
| Servo shaft / horn | 8 round shaft clearance plus 5-8 arm travel slot | Keep the servo horn outside the electronics compartment. |
| Ventilation | 1.5-2.0 wide slots, 8-12 spacing | EP8280 can run 300-350 mA at 5V and the enclosure should not tightly wrap it. Place vents away from direct rain/dust if used outside. |

## Layout Rules

- EP8280 front window should be flush or nearly flush to the scanner face. Do not put a deep tunnel in front of the QR reader.
- Use matte black plastic or paint around the EP8280 bezel to reduce internal reflection.
- Keep the scanner, LCD, and ultrasonic sensor on different front zones so a phone QR presentation does not block pass-through sensing.
- Put the Arduino behind a removable rear lid, not under glued parts.
- Keep all screw bosses away from lens, LCD glass, and ultrasonic transducers.
- Route servo power separately from signal wires where possible. Servo current spikes can reset the scanner or Arduino if the power rail is weak.
- Add strain relief for the power cable and EP8280 harness.

## Print Tolerances

- PCB/module pockets: add 0.5-1.0 clearance per side.
- Printed screw holes: add 0.2-0.4 diameter clearance, then drill clean if needed.
- Acrylic/glass window pocket: add 0.2-0.4 clearance per side.
- Connector openings: add 1.5-2.0 clearance around the plug body.
- Sliding rear lid/lip: add 0.3-0.5 clearance depending on printer calibration.
- Use fillets/chamfers on external edges, but keep sensor apertures dimensionally stable.

## Required Physical Measurements Before CAD Lock

Measure these with calipers before generating STL:

- Exact I2C LCD board, mounting hole spacing, and backpack depth.
- HC-SR04 transducer diameter and center spacing.
- Exact servo model, body, flange, shaft height from mounting face, and horn travel radius.
- Exact EP8280 cable/harness plug height and bend radius with the cable currently used.
- Arduino orientation, USB-C connector edge position, and whether USB-C or barrel/VIN will be the normal power path.
- External 5V regulator / buck converter board dimensions if it will live inside the enclosure.

## Wiring Clearance Map

Current Arduino sketch pin usage:

- EP8280 TX/DATA OUT to Arduino D0/RX1.
- EP8280 RX/DATA IN to Arduino D1/TX1 when sending `CMD_` settings.
- EP8280 decode LED output to D2 as diagnostic/fallback.
- EP8280 WG_DATA0 to D3 and WG_DATA1 to D4 for Wiegand diagnostics.
- HC-SR04 TRIG to D6 and ECHO to D7.
- Servo signal to D9.
- LCD SDA/SCL to Arduino SDA/SCL.

Keep a rear cable gutter wide enough for at least six small harnesses: EP8280, LCD, ultrasonic, servo, Arduino USB/power, and external 5V/common ground.

## CAD / STL Outputs

CAD/STL V1 was generated first and is now superseded for printing by V2:

- Blender scene: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_v1.blend`
- Main shell STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_shell_v1.stl`
- Rear lid STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_rear_lid_v1.stl`
- Front-panel fit-check STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_front_panel_fitcheck_v1.stl`
- Preview image: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_v1_preview.png`

CAD/STL CLI V2 was generated after owner feedback:

- Blender scene: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_cli_v2.blend`
- Main shell STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_shell_cli_v2.stl`
- Rear lid STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_rear_lid_cli_v2.stl`
- Front-panel fit-check STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_front_panel_fitcheck_cli_v2.stl`
- Preview image: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_cli_v2_preview.png`

Computer-use / Blender-native V2 was generated after owner feedback, but is now superseded by V3 because the enlarged scanner opening swallowed the EP8280 58 mm x 44 mm screw-hole positions in the front-panel fit-check:

- Blender scene: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_computeruse_v2.blend`
- Main shell STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_shell_computeruse_v2.stl`
- Rear lid STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_rear_lid_computeruse_v2.stl`
- Front-panel fit-check STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_front_panel_fitcheck_computeruse_v2.stl`
- Preview image: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_computeruse_v2_preview.png`

Computer-use / Blender-native V3 fixed the EP8280 front-panel screw holes, but is now superseded by V4 because the owner rejected the protruding right-side servo box/bracket:

- Blender scene: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_computeruse_v3.blend`
- Main shell STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_shell_computeruse_v3.stl`
- Rear lid STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_rear_lid_computeruse_v3.stl`
- Front-panel fit-check STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_front_panel_fitcheck_computeruse_v3.stl`
- Preview image: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_computeruse_v3_preview.png`
- Front-panel review image: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_front_panel_fitcheck_computeruse_v3_front.png`

Computer-use / Blender-native V4 removed the protruding right-side servo box/bracket, but is now superseded by V5 because the owner asked for the right-side notch to be closer in size to the smaller front service cutout:

- Blender scene: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_computeruse_v4.blend`
- Main shell STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_shell_computeruse_v4.stl`
- Rear lid STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_rear_lid_computeruse_v4.stl`
- Front-panel fit-check STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_front_panel_fitcheck_computeruse_v4.stl`
- Preview image: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_computeruse_v4_preview.png`
- Right-side notch review image: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_shell_computeruse_v4_side_notch.png`

Computer-use / Blender-native V5 is the preferred current print candidate:

- Blender scene: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_computeruse_v5.blend`
- Main shell STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_shell_computeruse_v5.stl`
- Rear lid STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_rear_lid_computeruse_v5.stl`
- Front-panel fit-check STL: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_front_panel_fitcheck_computeruse_v5.stl`
- Preview image: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_enclosure_computeruse_v5_preview.png`
- Right-side notch review image: `archive/school-project/hardware/fanpass_turnstile/enclosure/outputs/fanpass_turnstile_shell_computeruse_v5_side_notch.png`

V5 changes from owner feedback and computer-use review:

- The HC-SR04 ultrasonic cutout is now one larger rectangular service opening, not two circular transducer holes.
- EP8280 screw holes are tied to the 58 mm x 44 mm drawing center spacing. V5 keeps the smaller scanner optical window so the four round screw holes remain in printable front-panel material.
- The protruding right-side servo box/bracket and side screw collars were removed. The right side now has only a flush rectangular service notch in the enclosure wall, similar to the smaller front service cutout.
- The right-side service notch was reduced to about 30 x 18 mm, matching the scale of the smaller front service cutout.
- LCD, ultrasonic, service, and shell openings remain enlarged to reduce module-fit error.

The dependency-free STL generator lives at `archive/school-project/hardware/fanpass_turnstile/enclosure/fanpass_turnstile_enclosure.py`. The CLI Blender scene builder lives at `archive/school-project/hardware/fanpass_turnstile/enclosure/build_blender_scene.py`. The Blender-native comparison generator lives at `archive/school-project/hardware/fanpass_turnstile/enclosure/build_computeruse_variant.py`.

For the next fit revision, update the parametric CAD values with:

- `scanner_window_w`, `scanner_window_h`, and `scanner_depth`.
- `lcd_pocket_w`, `lcd_pocket_h`, and `lcd_depth`.
- `ultrasonic_center_spacing`.
- `servo_shaft_offset`.
- `arduino_usb_offset`.
- `wall_thickness`, `lid_overlap`, and `print_clearance`.

The safest first printable test is still the front-panel fit check, not the full box. Use `fanpass_turnstile_front_panel_fitcheck_computeruse_v5.stl` first, mount EP8280 + LCD + HC-SR04, verify alignment, then print the full enclosure. No physical print or fit-test has been completed yet.

## References

- Local EP8280 integration/spec text: `outputs/ep8280-docs/integration.txt`, `outputs/ep8280-docs/spec.txt`.
- EP8280 vendor integration PDF downloaded during this pass from Yokoscan download id 163.
- Arduino UNO R4 WiFi official datasheet/mechanical drawing: `https://docs.arduino.cc/hardware/uno-r4-wifi`.
- HC-SR04 reference user guide: `https://www.handsontec.com/dataspecs/HC-SR04-Ultrasonic.pdf`.
- TowerPro SG90 digital servo dimensions: `https://towerpro.com.tw/product/sg90-7/`.
- DFRobot I2C 16x2 LCD module reference dimensions: `https://www.dfrobot.com/product-135.html`.
