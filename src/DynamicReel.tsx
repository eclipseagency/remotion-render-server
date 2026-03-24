import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Easing,
  Sequence,
} from "remotion";

interface Props {
  designUrl: string;
  topic: string;
  caption: string;
  clientName: string;
  style: "auto" | "zoom" | "pan" | "reveal" | "kinetic";
  durationInFrames: number;
}

export const DynamicReel: React.FC<Props> = ({
  designUrl,
  topic,
  caption,
  clientName,
  style,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Pick motion style — "auto" cycles through effects
  const effectStyle =
    style === "auto"
      ? ["zoom", "pan", "reveal", "kinetic"][
          Math.floor((frame / durationInFrames) * 0) // Use hash of topic for variety
        ] || "zoom"
      : style;

  // ── Shared: smooth progress 0→1 over duration
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: "clamp",
  });

  // ── Intro: fade from black (first 15 frames)
  const introOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // ── Outro: fade to black (last 15 frames)
  const outroOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = Math.min(introOpacity, outroOpacity);

  // ── ZOOM IN: slow zoom from 100% to 115%
  const zoomScale = interpolate(frame, [0, durationInFrames], [1, 1.15], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // ── PAN: slow horizontal pan
  const panX = interpolate(frame, [0, durationInFrames], [-3, 3], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  // ── REVEAL: scale from 80% with spring
  const revealSpring = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 100 },
  });
  const revealScale = interpolate(revealSpring, [0, 1], [0.8, 1]);

  // ── KINETIC: subtle float + rotation
  const kineticY = Math.sin(frame * 0.03) * 8;
  const kineticRotate = Math.sin(frame * 0.02) * 0.5;

  // Pick transform based on style
  let imageTransform = "";
  if (style === "zoom" || style === "auto") {
    imageTransform = `scale(${zoomScale})`;
  } else if (style === "pan") {
    imageTransform = `scale(1.08) translateX(${panX}%)`;
  } else if (style === "reveal") {
    imageTransform = `scale(${revealScale})`;
  } else if (style === "kinetic") {
    imageTransform = `scale(1.05) translateY(${kineticY}px) rotate(${kineticRotate}deg)`;
  }

  // ── Text animation (if topic provided)
  const textDelay = 20; // frames
  const textSpring = spring({
    frame: Math.max(0, frame - textDelay),
    fps,
    config: { damping: 60, stiffness: 120 },
  });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);
  const textY = interpolate(textSpring, [0, 1], [30, 0]);

  // ── Subtle vignette
  const vignetteGradient =
    "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)";

  // ── Subtle film grain
  const grainOpacity = 0.03;

  const isRTL = /[\u0600-\u06FF]/.test(topic);
  const isTextOnly = !designUrl;

  // ── Text-only mode: split topic into lines for kinetic reveal ──
  const lines = topic ? topic.split('\n').filter((l: string) => l.trim()) : [];

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0f", overflow: "hidden" }}>

      {/* ═══ MODE 1: Design image with motion ═══ */}
      {designUrl && (
        <>
          <AbsoluteFill
            style={{
              opacity,
              transform: imageTransform,
              transformOrigin: "center center",
            }}
          >
            <Img
              src={designUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </AbsoluteFill>

          {/* Text overlay on design (bottom area) */}
          {topic && !topic.startsWith('[') && (
            <Sequence from={textDelay}>
              <AbsoluteFill
                style={{
                  justifyContent: "flex-end",
                  alignItems: "center",
                  padding: "0 60px 120px",
                }}
              >
                <div
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    backdropFilter: "blur(10px)",
                    borderRadius: 16,
                    padding: "16px 28px",
                    opacity: textOpacity,
                    transform: `translateY(${textY}px)`,
                  }}
                >
                  <p
                    style={{
                      color: "#fff",
                      fontSize: 36,
                      fontWeight: 700,
                      textAlign: "center",
                      lineHeight: 1.4,
                      fontFamily: "Arial, sans-serif",
                      margin: 0,
                      direction: isRTL ? "rtl" : "ltr",
                    }}
                  >
                    {topic}
                  </p>
                </div>
              </AbsoluteFill>
            </Sequence>
          )}
        </>
      )}

      {/* ═══ MODE 2: Text-only — kinetic typography ═══ */}
      {isTextOnly && topic && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            padding: "80px 60px",
            opacity,
          }}
        >
          {/* Animated background gradient */}
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse at ${50 + Math.sin(frame * 0.01) * 10}% ${50 + Math.cos(frame * 0.015) * 10}%, #1a1a2e 0%, #0a0a0f 70%)`,
            }}
          />

          {/* Accent line */}
          <div
            style={{
              position: "absolute",
              top: "15%",
              left: "50%",
              transform: `translateX(-50%) scaleX(${interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" })})`,
              width: 60,
              height: 3,
              background: "#6366f1",
              borderRadius: 2,
            }}
          />

          {/* Lines revealed one by one */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
              direction: isRTL ? "rtl" : "ltr",
              zIndex: 1,
            }}
          >
            {lines.map((line: string, i: number) => {
              const lineDelay = 15 + i * 20; // stagger each line
              const lineSpring = spring({
                frame: Math.max(0, frame - lineDelay),
                fps,
                config: { damping: 50, stiffness: 100 },
              });
              const lineOpacity = interpolate(lineSpring, [0, 1], [0, 1]);
              const lineY = interpolate(lineSpring, [0, 1], [40, 0]);

              // First line = big headline, rest = smaller
              const isHeadline = i === 0;

              return (
                <div
                  key={i}
                  style={{
                    opacity: lineOpacity,
                    transform: `translateY(${lineY}px)`,
                  }}
                >
                  <p
                    style={{
                      color: isHeadline ? "#fff" : "#b0b0c0",
                      fontSize: isHeadline ? 52 : 32,
                      fontWeight: isHeadline ? 800 : 500,
                      textAlign: "center",
                      lineHeight: 1.3,
                      fontFamily: "Arial, sans-serif",
                      margin: 0,
                      letterSpacing: isHeadline ? -1 : 0,
                    }}
                  >
                    {line}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Client name at bottom */}
          {clientName && (
            <div
              style={{
                position: "absolute",
                bottom: 80,
                opacity: interpolate(frame, [durationInFrames * 0.3, durationInFrames * 0.4], [0, 0.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                fontSize: 18,
                fontWeight: 600,
                color: "#6366f1",
                letterSpacing: 4,
                textTransform: "uppercase",
                fontFamily: "Arial, sans-serif",
              }}
            >
              {clientName}
            </div>
          )}
        </AbsoluteFill>
      )}

      {/* Vignette */}
      <AbsoluteFill
        style={{
          background: vignetteGradient,
          pointerEvents: "none",
        }}
      />

      {/* Grain */}
      <AbsoluteFill
        style={{
          opacity: grainOpacity,
          pointerEvents: "none",
          mixBlendMode: "overlay",
        }}
      >
        <svg width="100%" height="100%">
          <filter id="grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              seed={frame % 60}
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
