export type WorkPhotoCrop = {
  rotation: 0 | 90 | 180 | 270;
  zoom: number;
  x: number;
  y: number;
};

export type CropPreviewGeometry = {
  rotatedWidth: number;
  rotatedHeight: number;
  cropWidth: number;
  cropHeight: number;
  cropLeft: number;
  cropTop: number;
  imageCenterXPercent: number;
  imageCenterYPercent: number;
  imageWidthPercent: number;
  imageHeightPercent: number;
};

export function getCropPreviewGeometry(
  sourceWidth: number,
  sourceHeight: number,
  crop: WorkPhotoCrop,
): CropPreviewGeometry | undefined {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    !Number.isFinite(crop.zoom) ||
    !Number.isFinite(crop.x) ||
    !Number.isFinite(crop.y) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    crop.zoom <= 0
  ) {
    return undefined;
  }

  const swapsSides = crop.rotation === 90 || crop.rotation === 270;
  const rotatedWidth = swapsSides ? sourceHeight : sourceWidth;
  const rotatedHeight = swapsSides ? sourceWidth : sourceHeight;
  const baseWidth = Math.floor(Math.min(rotatedWidth, rotatedHeight * 0.8) / 4) * 4;
  const cropWidth = Math.floor(baseWidth / crop.zoom / 4) * 4;
  const cropHeight = (cropWidth * 5) / 4;

  if (cropWidth < 4 || cropHeight > rotatedHeight) {
    return undefined;
  }

  const availableX = rotatedWidth - cropWidth;
  const availableY = rotatedHeight - cropHeight;
  const cropLeft = Math.round(((crop.x + 1) / 2) * availableX);
  const cropTop = Math.round(((crop.y + 1) / 2) * availableY);
  const cropCenterOffsetX = cropLeft + cropWidth / 2 - rotatedWidth / 2;
  const cropCenterOffsetY = cropTop + cropHeight / 2 - rotatedHeight / 2;

  return {
    rotatedWidth,
    rotatedHeight,
    cropWidth,
    cropHeight,
    cropLeft,
    cropTop,
    imageCenterXPercent: 50 - (cropCenterOffsetX / cropWidth) * 100,
    imageCenterYPercent: 50 - (cropCenterOffsetY / cropHeight) * 100,
    imageWidthPercent: (sourceWidth / cropWidth) * 100,
    imageHeightPercent: (sourceHeight / cropHeight) * 100,
  };
}
