/**
 * Serialises every write to the spreadsheet. One user, one queue — which removes
 * an entire class of row-collision bug for the cost of a few lines.
 */
export class Mutex {
  #chain = Promise.resolve();

  run(task) {
    const result = this.#chain.then(task, task);
    this.#chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
