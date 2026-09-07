// Product art is independent of model-worn sprites. These paths are never used by the stage.
export const PRODUCT_OUTPUT = "public/game/studio/products";
const ARCHIVED_PRODUCT_PREVIEWS = {
  "top-white-basic": { mode: "alpha" },
  "top-white-lace": { mode: "alpha" },
  "top-ivory-pointelle": { mode: "alpha" },
  "top-black-tee": { mode: "exterior" },
  "top-gray-v": { mode: "exterior" },
  "top-red-offshoulder": { mode: "exterior" },
  "bottom-blue-jeans": { mode: "exterior" },
  "bottom-sculpted-jeans": {
    mode: "exterior",
    source: "assets/studio/sources/products/edited/bottom-sculpted-jeans-v1.png",
  },
  "bottom-black-mini": { mode: "exterior" },
  "bottom-navy-dots": { mode: "exterior" },
  "bottom-gray-maxi": { mode: "exterior" },
  // Reviewed silhouettes on the original 1024x1536 product canvas.
  // White fabric cannot be separated safely by a global brightness threshold.
  "bottom-white-shorts": {
    mode: "silhouette",
    outline: "M274 367 Q512 416 750 367 L764 411 L892 921 Q733 976 536 994 L513 874 L497 994 Q292 976 129 921 L261 411 Z",
  },
  "bottom-white-pleats": {
    mode: "silhouette",
    outline: "M334 310 Q512 337 690 310 L713 407 L822 672 Q732 721 624 738 Q563 748 501 746 Q339 748 201 672 L309 407 Z",
  },
  "shoes-mary-janes": { mode: "exterior", source: "assets/studio/sources/products/edited/shoes-mary-janes-v2.png" },
  "shoes-brown-boots": { mode: "alpha", source: "assets/studio/sources/products/approved/shoes-brown-boots.png" },
};

export const PRODUCT_PREVIEWS = {
  "top-fitted-denim": {
    mode: "exterior",
    source: "assets/studio/sources/products/approved/top-fitted-denim-v3.png",
  },
  "top-modal-grommet": {
    mode: "exterior",
    source: "assets/studio/sources/products/approved/top-modal-grommet-v4.png",
  },
  "bottom-sculpted-jeans": {
    mode: "exterior",
    source: "assets/studio/sources/products/edited/bottom-sculpted-jeans-v2.png",
  },
  "bottom-denim-sculpted-skirt": {
    mode: "exterior",
    source: "assets/studio/sources/products/approved/bottom-denim-sculpted-skirt-v5.png",
  },
  "shoes-mary-janes": ARCHIVED_PRODUCT_PREVIEWS["shoes-mary-janes"],
};
