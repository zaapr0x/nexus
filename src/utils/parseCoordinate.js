function parseMinecraftPosition(positionString) {
  const regex = /BlockPos\{x=(-?\d+), y=(-?\d+), z=(-?\d+)\}/;
  const match = regex.exec(positionString);

  if (!match) {
    throw new Error("Invalid position format: " + positionString);
  }

  return {
    x: parseInt(match[1], 10),
    y: parseInt(match[2], 10),
    z: parseInt(match[3], 10),
  };
}
module.exports = { parseMinecraftPosition };
