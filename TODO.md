# TODO

## PAINT: normalize flow with respect to time

1 sec for x% flow to get to 100% opacity.
Find x value through experimentation.
Find scaling function for flow by studying the integration of repeated applications of the brush color and alpha.

## PRESENT: add border to paint area

It could be really cool to implement the border by using JFA (Jump Flood Algorithm) as it is the same algo that will be used to create SDFs from images.

## PAINT: add eraser

## UX: add view controls

Note that the translation in present's view matrix is probably applied in the wrong order.

## BRUSH: add import

Remember to downsample and to correct aspect ratio on import.
Use JFA to generate SDF.
Use SDF to get smooth brush edges and feathering.
Maybe mix original color and user selected brush color.
Maybe create a few examples and pre-load them.
Try downsampling both the SDF and the JFA's input to save on memory (important as a few of these will be served through the web).

## UX: add undo functionality

Probably diff-based, saved on pointer up events.
Could use a transparent double-buffer to paint on, apply on pointer-up to the main texture, composite the two during present.
Probably compressed, almost certainly saved in ring buffer.

## PAINT: implement real opacity modulation by capping the temp buffer alpha

**ONLY IF: UNDO is implemented though temporary double-buffer**

## FINAL TOUCHES

-   Make the UI pretty
-   Add save functionality
-   Maybe add button to load current image as brush

## DEPLOY IN AWS, ADD TO CV
