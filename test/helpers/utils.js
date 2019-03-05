export const delay = howMuch =>
  new Promise(resolve => {
    setTimeout(resolve, howMuch);
  });
