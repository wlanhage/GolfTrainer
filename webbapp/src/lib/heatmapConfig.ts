// Delade konstanter för shot-predictor heatmap (visas både på klubb-detaljsidan
// och som overlay på spel-kartan).
//
// GRID_SIZE måste vara udda så att gridden är centrerad på (0, 0).
// Total täckning per axel = (GRID_SIZE / 2) * BIN_SIZE_METERS i varje riktning.
//
// 9 × 9 @ 6 m → ±27 m täckning, 81 celler totalt, ~36 px cellbredd på 360 px-skärm,
// normalt 15–28 populerade celler vid 10+ slag.

export const HEATMAP_GRID_SIZE = 9;
export const HEATMAP_BIN_SIZE_METERS = 6;
