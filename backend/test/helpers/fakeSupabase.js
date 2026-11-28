const crypto = require("crypto");

// Postgres LIKE: % and _ are wildcards unless escaped with a backslash.
function likeToRegExp(pattern) {
  const source = String(pattern).replace(/\\(.)|(%)|(_)|([^\\%_]+)/g, (_m, escaped, any, one, text) => {
    if (any) return ".*";
    if (one) return ".";
    return (escaped ?? text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  return new RegExp(`^${source}$`, "is");
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function splitColumns(selectStr) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of selectStr) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const RELATION_CONFIG = {
  flashcard_decks: {
    flashcards: { type: "children", targetTable: "flashcards", fk: "deck_id" },
  },
  flashcards: {
    flashcard_decks: { type: "parent", targetTable: "flashcard_decks", fk: "deck_id" },
  },
};

function createFakeSupabase(initialData = {}) {
  const tables = {};
  for (const [name, rows] of Object.entries(initialData)) {
    tables[name] = rows.map((r) => clone(r));
  }

  function getTable(name) {
    if (!tables[name]) tables[name] = [];
    return tables[name];
  }

  function buildRowDefaults(tableName, row) {
    const now = new Date().toISOString();
    const record = {
      id: row.id ?? crypto.randomUUID(),
      created_at: row.created_at ?? now,
      updated_at: row.updated_at ?? now,
      ...clone(row),
    };
    if (tableName === "tasks") {
      if (record.status === undefined) record.status = "pending";
      if (record.repeat === undefined) record.repeat = "none";
      if (record.repeat_parent === undefined) record.repeat_parent = null;
    }
    return record;
  }

  function createQueryBuilder(tableName) {
    const state = {
      operation: null,
      selectCols: "*",
      returnRows: false,
      payload: null,
      upsertOptions: null,
      filters: [],
      orders: [],
      limitCount: null,
      expectSingle: null, // "single" | "maybeSingle" | null
    };

    function parseSelectRelations() {
      const cols = splitColumns(state.selectCols || "*");
      const innerParents = [];
      const childEmbeds = [];
      const plainCols = [];
      let includeAll = false;

      for (const col of cols) {
        if (col === "*") {
          includeAll = true;
          continue;
        }
        const relMatch = col.match(/^([a-zA-Z0-9_]+)(!inner)?\(([^)]*)\)$/);
        if (relMatch) {
          const [, relName, innerFlag] = relMatch;
          const cfg = RELATION_CONFIG[tableName]?.[relName];
          if (!cfg) {
            throw new Error(`Unsupported relation in fakeSupabase: ${tableName} -> ${relName}`);
          }
          if (cfg.type === "parent" && innerFlag) {
            innerParents.push({ relName, ...cfg });
          } else if (cfg.type === "children") {
            childEmbeds.push({ relName, ...cfg });
          }
          continue;
        }
        plainCols.push(col);
      }
      return { includeAll, plainCols, innerParents, childEmbeds };
    }

    function matchesFilters(row, innerParents) {
      for (const f of state.filters) {
        let actual;
        if (f.col.includes(".")) {
          const [relName, relCol] = f.col.split(".");
          const parentCfg = innerParents.find((p) => p.relName === relName);
          if (!parentCfg) {
            throw new Error(`Unsupported qualified filter column: ${f.col}`);
          }
          const parentRow = getTable(parentCfg.targetTable).find((p) => p.id === row[parentCfg.fk]);
          if (!parentRow) return false;
          actual = parentRow[relCol];
        } else {
          actual = row[f.col];
        }

        if (f.op === "eq") {
          if (actual !== f.val) return false;
        } else if (f.op === "in") {
          if (!Array.isArray(f.val) || !f.val.includes(actual)) return false;
        } else if (f.op === "gte") {
          if (actual === undefined || actual === null || actual < f.val) return false;
        } else if (f.op === "lt") {
          if (actual === undefined || actual === null || actual >= f.val) return false;
        } else if (f.op === "lte") {
          if (actual === undefined || actual === null || actual > f.val) return false;
        } else if (f.op === "ilike") {
          if (typeof actual !== "string" || !likeToRegExp(f.val).test(actual)) return false;
        }
      }

      for (const parentCfg of innerParents) {
        const parentRow = getTable(parentCfg.targetTable).find((p) => p.id === row[parentCfg.fk]);
        if (!parentRow) return false;
      }

      return true;
    }

    function projectRow(row, { includeAll, plainCols, childEmbeds, innerParents }) {
      let out;
      if (includeAll || plainCols.length === 0) {
        out = clone(row);
      } else {
        out = {};
        for (const col of plainCols) {
          out[col] = clone(row[col]);
        }
      }
      for (const child of childEmbeds) {
        out[child.relName] = getTable(child.targetTable)
          .filter((c) => c[child.fk] === row.id)
          .map((c) => clone(c));
      }
      for (const parent of innerParents) {
        const p = getTable(parent.targetTable).find((x) => x.id === row[parent.fk]);
        out[parent.relName] = p ? clone(p) : null;
      }
      return out;
    }

    function formatResult(rows) {
      if (state.expectSingle === "single") {
        if (rows.length !== 1) {
          return { data: null, error: { message: "Row not found", code: "PGRST116" } };
        }
        return { data: rows[0], error: null };
      }
      if (state.expectSingle === "maybeSingle") {
        if (rows.length > 1) {
          return { data: null, error: { message: "Multiple rows returned" } };
        }
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    }

    function execute() {
      const table = getTable(tableName);
      const parsed = parseSelectRelations();

      if (state.operation === "select") {
        let rows = table.filter((r) => matchesFilters(r, parsed.innerParents));
        if (state.orders.length > 0) {
          rows = [...rows].sort((a, b) => {
            for (const o of state.orders) {
              const cmp = compareValues(a[o.col], b[o.col]);
              if (cmp !== 0) return o.ascending ? cmp : -cmp;
            }
            return 0;
          });
        }
        if (state.limitCount !== null) {
          rows = rows.slice(0, state.limitCount);
        }
        const projected = rows.map((r) => projectRow(r, parsed));
        return formatResult(projected);
      }

      if (state.operation === "insert") {
        const items = Array.isArray(state.payload) ? state.payload : [state.payload];
        const built = items.map((item) => buildRowDefaults(tableName, item));
        if (tableName === "tasks") {
          for (const rec of built) {
            if (
              rec.repeat_parent !== null &&
              rec.repeat_parent !== undefined &&
              table.some((r) => r.repeat_parent === rec.repeat_parent)
            ) {
              return {
                data: null,
                error: {
                  message: 'duplicate key value violates unique constraint "idx_tasks_repeat_parent"',
                  code: "23505",
                },
              };
            }
          }
        }
        const inserted = built.map((rec) => {
          table.push(rec);
          return rec;
        });
        if (!state.returnRows) {
          return { data: null, error: null };
        }
        return formatResult(inserted.map((r) => projectRow(r, parsed)));
      }

      if (state.operation === "upsert") {
        const items = Array.isArray(state.payload) ? state.payload : [state.payload];
        const conflictCol = state.upsertOptions?.onConflict || "id";
        const resultRows = [];
        for (const item of items) {
          const idx =
            item[conflictCol] !== undefined
              ? table.findIndex((r) => r[conflictCol] === item[conflictCol])
              : -1;
          if (idx !== -1) {
            const updated = { ...table[idx], ...clone(item), updated_at: new Date().toISOString() };
            table[idx] = updated;
            resultRows.push(updated);
          } else {
            const rec = buildRowDefaults(tableName, item);
            table.push(rec);
            resultRows.push(rec);
          }
        }
        if (!state.returnRows) {
          return { data: null, error: null };
        }
        return formatResult(resultRows.map((r) => projectRow(r, parsed)));
      }

      if (state.operation === "update") {
        const patch = {};
        for (const [k, v] of Object.entries(state.payload || {})) {
          if (v !== undefined) patch[k] = clone(v);
        }
        const updated = [];
        for (let i = 0; i < table.length; i += 1) {
          if (matchesFilters(table[i], parsed.innerParents)) {
            table[i] = { ...table[i], ...patch };
            updated.push(table[i]);
          }
        }
        if (!state.returnRows) {
          return { data: null, error: null };
        }
        return formatResult(updated.map((r) => projectRow(r, parsed)));
      }

      if (state.operation === "delete") {
        const kept = [];
        const deleted = [];
        for (const row of table) {
          if (matchesFilters(row, parsed.innerParents)) {
            deleted.push(row);
          } else {
            kept.push(row);
          }
        }
        tables[tableName] = kept;
        if (!state.returnRows) {
          return { data: null, error: null };
        }
        return formatResult(deleted.map((r) => projectRow(r, parsed)));
      }

      throw new Error(`Unsupported or missing Supabase operation on table ${tableName}`);
    }

    const methods = {
      select(cols = "*") {
        if (!state.operation) {
          state.operation = "select";
        } else {
          state.returnRows = true;
        }
        state.selectCols = cols;
        return proxy;
      },
      insert(rows) {
        state.operation = "insert";
        state.payload = rows;
        return proxy;
      },
      update(patch) {
        state.operation = "update";
        state.payload = patch;
        return proxy;
      },
      delete() {
        state.operation = "delete";
        return proxy;
      },
      upsert(rows, options) {
        state.operation = "upsert";
        state.payload = rows;
        state.upsertOptions = options || null;
        return proxy;
      },
      eq(col, val) {
        state.filters.push({ op: "eq", col, val });
        return proxy;
      },
      in(col, val) {
        state.filters.push({ op: "in", col, val });
        return proxy;
      },
      gte(col, val) {
        state.filters.push({ op: "gte", col, val });
        return proxy;
      },
      lt(col, val) {
        state.filters.push({ op: "lt", col, val });
        return proxy;
      },
      lte(col, val) {
        state.filters.push({ op: "lte", col, val });
        return proxy;
      },
      ilike(col, val) {
        state.filters.push({ op: "ilike", col, val });
        return proxy;
      },
      order(col, { ascending = true } = {}) {
        state.orders.push({ col, ascending });
        return proxy;
      },
      limit(n) {
        state.limitCount = n;
        return proxy;
      },
      single() {
        state.expectSingle = "single";
        return proxy;
      },
      maybeSingle() {
        state.expectSingle = "maybeSingle";
        return proxy;
      },
      then(resolve, reject) {
        return Promise.resolve().then(() => execute()).then(resolve, reject);
      },
    };

    const proxy = new Proxy(methods, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (typeof prop === "symbol" || prop === "catch" || prop === "finally") {
          return undefined;
        }
        return () => {
          throw new Error(`Unsupported Supabase query method: ${String(prop)}`);
        };
      },
    });

    return proxy;
  }

  const client = {
    from(tableName) {
      return createQueryBuilder(tableName);
    },
    rpc(fnName, params = {}) {
      const today = new Date().toISOString().slice(0, 10);
      if (fnName === "bump_ai_usage") {
        const { p_student, p_limit } = params;
        if (!Number.isInteger(p_limit) || p_limit <= 0) {
          return Promise.resolve({ data: false, error: null });
        }
        const table = getTable("ai_usage");
        const existing = table.find((r) => r.student_id === p_student && r.day === today);
        if (!existing) {
          table.push({
            id: crypto.randomUUID(),
            student_id: p_student,
            day: today,
            count: 1,
            created_at: new Date().toISOString(),
          });
          return Promise.resolve({ data: true, error: null });
        }
        if (existing.count < p_limit) {
          existing.count += 1;
          return Promise.resolve({ data: true, error: null });
        }
        return Promise.resolve({ data: false, error: null });
      }
      if (fnName === "refund_ai_usage") {
        const { p_student } = params;
        const table = getTable("ai_usage");
        const existing = table.find((r) => r.student_id === p_student && r.day === today);
        if (existing && existing.count > 0) {
          existing.count -= 1;
        }
        return Promise.resolve({ data: null, error: null });
      }
      throw new Error(`Unsupported Supabase client method: rpc(${fnName})`);
    },
    tables,
  };

  return new Proxy(client, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "symbol") return undefined;
      return () => {
        throw new Error(`Unsupported Supabase client method: ${String(prop)}`);
      };
    },
  });
}

module.exports = { createFakeSupabase };
