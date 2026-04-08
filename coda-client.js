const BASE_URL = 'https://coda.io/apis/v1';

class CodaClient {
  constructor(apiToken, docId) {
    this.apiToken = apiToken;
    this.docId = docId;
    this.headers = {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    };
  }

  async getRows(tableId, query = {}) {
    const params = new URLSearchParams();
    params.set('useColumnNames', 'true');
    params.set('valueFormat', 'rich');
    // Coda API query format is "columnName":jsonValue
    // Column names are quoted, string values are JSON-encoded (i.e. also quoted)
    for (const [col, val] of Object.entries(query)) {
      params.append('query', `"${col}":${JSON.stringify(val)}`);
    }
    const url = `${BASE_URL}/docs/${this.docId}/tables/${tableId}/rows?${params}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) {
      throw new Error(`Coda API error ${res.status}: ${await res.text()}`);
    }
    const data = await res.json();
    return data.items;
  }

  async getRow(tableId, query) {
    const rows = await this.getRows(tableId, query);
    if (rows.length === 0) {
      throw new Error(`No row found matching query: ${JSON.stringify(query)}`);
    }
    return rows[0];
  }

  // With useColumnNames=true, values are already keyed by column name
  async getRowByName(tableId, query) {
    const row = await this.getRow(tableId, query);
    return row.values;
  }

  async getRowsByName(tableId, query = {}) {
    const rows = await this.getRows(tableId, query);
    return rows.map((row) => row.values);
  }

  async updateRow(tableId, rowId, cells) {
    // cells: { 'Column Name': value, ... }
    const url = `${BASE_URL}/docs/${this.docId}/tables/${tableId}/rows/${rowId}?useColumnNames=true`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({
        row: {
          cells: Object.entries(cells).map(([column, value]) => ({ column, value })),
        },
      }),
    });
    if (!res.ok) {
      throw new Error(`Coda API error ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }
}

module.exports = CodaClient;
