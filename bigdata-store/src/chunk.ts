import {ITableBuilder, Table, TableSchema} from '@subsquid/bigdata-table'
import {assertNotNull} from '@subsquid/util-internal'

export class Chunk {
    private tableBuilders: Map<string, ITableBuilder<any>>

    constructor(public from: number, public to: number, tables: Table<any>[]) {
        this.tableBuilders = new Map(tables.map((t) => [t.name, t.createTableBuilder()]))
    }

    getTableBuilder<T extends TableSchema<any>>(name: string): ITableBuilder<T> {
        return assertNotNull(this.tableBuilders.get(name), `Table "${name}" does not exist`)
    }

    get size() {
        let total = 0
        for (let table of this.tableBuilders.values()) {
            total += table.size
        }
        return total
    }
}
