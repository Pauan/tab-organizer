const readers = [];
const writers = [];

let batching = false;

const loop = () => {
  for (let i = 0; i < readers["length"]; ++i) {
    readers[i]();
  }

  readers["length"] = 0;

  for (let i = 0; i < writers["length"]; ++i) {
    writers[i]();
  }

  writers["length"] = 0;

  if (readers["length"] === 0) {
    batching = false;

  } else {
    requestAnimationFrame(loop);
  }
};

const batch = () => {
  if (!batching) {
    batching = true;

    requestAnimationFrame(loop);
  }
};

export const batch_read = (f) => {
  readers["push"](f);
  batch();
};

export const batch_write = (f) => {
  writers["push"](f);
  batch();
};
