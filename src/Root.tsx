import React from "react";
import { Composition } from "remotion";
import { DynamicReel } from "./DynamicReel";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DynamicReel"
        component={DynamicReel}
        durationInFrames={240}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          designUrl: "",
          topic: "",
          caption: "",
          clientName: "",
          style: "auto",
          durationInFrames: 240,
        }}
      />
    </>
  );
};
