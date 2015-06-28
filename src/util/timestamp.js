// TODO this probably isn't super-robust, but it should work for common cases
let max = null;

// Guarantees uniqueness
export const timestamp = () => {
  const x = Date["now"]();
  if (max === null || x > max) {
    max = x;
  } else {
    ++max;
  }
  return max;
};
