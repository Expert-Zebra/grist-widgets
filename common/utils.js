/**
 * Returns the INDEX of a row (please stop forgetting this)
 * @returns {number} index
 * */
function getRowIndex(table, column, value) {
  return table[column].findIndex((el) => el === value);
}

function getRowID(table, column, value) {
  return table.id[getRowIndex(table, column, value)];
}

class RowTable {
  constructor(data) {
    this.data = data;
  }

  /**
   * @param {string} key
   * @param {string} value
   * @returns {RowRecord}
   * */
  getRowFromData([key, value]) {
    return this.data[this.data.findIndex((val) => val[key] === value)]
  }
}

class GristTable {
  constructor(data) {
    this.data = data;
  }

  /**
   * @param {string} key
   * @param {string|number} value
   * @param {string[]} [columns]
   * @returns {RowRecord}
   * */
  getRowFromData([key, value], columns) {
    const index = this.data[key].indexOf(value);

    return this.getRowFromIndex(index, columns);
  }

  /**
   * @param {number} id
   * @param {string[]} [columns]
   * @returns {RowRecord}
   * */
  getRowFromId(id, columns) {
    return this.getRowFromData(['id', id], columns);
  }


  /**
   * @param {number} i
   * @param {string[]} [columns]
   * @returns {RowRecord}
   * */
  getRowFromIndex(i, columns) {
    const row = {};
    const cols = columns || Object.keys(this.data);

    cols.forEach((column) => {
      row[column] = this.data[column][i];
    });

    return row;
  }
}

/**
 * @param list {string[]}
 * @param addition {string|number}
 * @param deletion {string|number}
 * @returns {string[]}
 * */
function updateCellList(list = [], addition, deletion) {
  const listSet = new Set(list);

  listSet.delete("");

  if (addition) listSet.add(addition);

  if (deletion) listSet.delete(deletion);

  return [...listSet];
}

function formatOrdinals(n) {
  if (n.toString().length > 3) return n;

  const pr = new Intl.PluralRules("en-US", { type: "ordinal" });
  const suffixes = new Map([
    ["one", "st"],
    ["two", "nd"],
    ["few", "rd"],
    ["other", "th"],
  ]);

  const rule = pr.select(n);
  const suffix = suffixes.get(rule);
  return `${n}${suffix}`;
}
