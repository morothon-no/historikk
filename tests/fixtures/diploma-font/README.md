# Numeric Range regression fixture

Test-only subset of Noto Sans Bold, Debian fonts-noto-core, renamed to
Morothon Layout Regression. Retains original glyph outlines, ascender/descender
metrics and hinting; only the character set and internal family names change.
SIL Open Font License 1.1 is in OFL.txt. Source: https://github.com/notofonts/noto-fonts.

Source SHA-256: `e83493c945848ecd4a9ad0f6d19164541a0d3e23a9c952304a00a46e00272ac5`.
Subset contains space, digits and :%., only. It is served by browser tests,
not the runtime site or medal register. It reproduces the four reported
Range-based failures with real font shaping, without mocking DOM rectangles.
This is a reproducible cross-font case; it is not a claim that the affected
Windows browser used Noto Sans.

The Windows observation in windows-observation.json records the user's actual
Chrome 157/DPR 1 measurements. The browser test uses ascent-override:110%,
descent-override:31% and line-gap-override:0% on this font to reproduce the
observed 91px Range height and exact 4.000015589983434px outsideField.top.
These overrides change font metrics, not glyph outlines. The fixture is not
presented as the user's Windows font; it reproduces its measured vertical case.
