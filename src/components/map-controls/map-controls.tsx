import "./map-controls.css";
import type { FC } from "react";
import Image from "next/image";
import minusIcon from "@/assets/img/minus.png";
import plusIcon from "@/assets/img/add.png";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export const ZoomControls: FC<ZoomControlsProps> = ({
  onZoomIn,
  onZoomOut,
}) => (
  <div className={"map-controls"}>
    <button onClick={onZoomIn} className={"zoom-btn"}>
      <Image 
        className={"zoom-icon"} 
        src={plusIcon.src} 
        alt="Zoom In" 
        width={44} 
        height={44} 
        priority
      />
    </button>
    <button onClick={onZoomOut} className={"zoom-btn"}>
      <Image 
        className={"zoom-icon"} 
        src={minusIcon.src} 
        alt="Zoom Out" 
        width={44} 
        height={44} 
        priority
      />
    </button>
    
  </div>
);
