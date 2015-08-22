const readers = [];
const writers = [];
let batching = false;


// TODO is this slow ?
const run = (a) => {
  for (let i = 0; i < a["length"]; ++i) {
    a[i]();
  }

  // TODO is this slow ?
  a["length"] = 0;
};


const loop = () => {
  run(readers);
  run(writers);

  // More stuff is scheduled, run them on the next frame
  if (readers["length"]) {
    requestAnimationFrame(loop);

  } else {
    batching = false;
  }
};


const batch = () => {
  if (!batching) {
    batching = true;

    requestAnimationFrame(loop);
  }
};


export const batch_read = (f) => {
  //setTimeout(f, 1000);
  f();
  //readers["push"](f);
  //batch();
};

export const batch_write = (f) => {
  //setTimeout(f, 1000);
  f();
  //writers["push"](f);
  //batch();
};
