export type Type<T> = {
    validate(value: unknown): T
}

export interface ColumnOptions {
    nullable?: boolean
}

export interface ColumnData<T extends Type<any> = Type<any>, O extends ColumnOptions = ColumnOptions> {
    type: T
    options: O
}

type NullableColumns<T extends Record<string, ColumnData>> = {
    [F in keyof T]: T[F] extends ColumnData<any, infer R> ? (R extends {nullable: true} ? F : never) : never
}[keyof T]

export type ConvertColumnsToTypes<T extends Record<string, ColumnData>> = {
    [F in Exclude<keyof T, NullableColumns<T>>]: T[F] extends ColumnData<Type<infer R>> ? R : never
} & {
    [F in Extract<keyof T, NullableColumns<T>>]?: T[F] extends ColumnData<Type<infer R>> ? R | null | undefined : never
}

export interface TableSchema<C extends ColumnData> {
    [column: string]: C
}

export interface Column<C extends ColumnData> {
    name: string
    data: C
}

export abstract class Table<T extends TableSchema<ColumnData>> {
    readonly columns: Column<T[Extract<keyof T, string>]>[] = []

    constructor(readonly name: string, protected schema: T) {
        for (let column in schema) {
            this.columns.push({
                name: column,
                data: schema[column],
            })
        }
    }

    abstract createTableBuilder(): TableBuilder<T>
    abstract getFileExtension(): string
}

export type TableRecord<T extends TableSchema<any> | Table<any>> = T extends Table<infer R>
    ? ConvertColumnsToTypes<R>
    : T extends TableSchema<any>
    ? ConvertColumnsToTypes<T>
    : never

export interface TableBuilder<T extends TableSchema<any>> {
    get size(): number

    append(records: TableRecord<T> | TableRecord<T>[]): TableBuilder<T>
    toTable(): string | Uint8Array
}

export interface TableBuilderContructor {
    new <T extends TableSchema<any>>(table: Table<T>): TableBuilder<T>
}

// let a = new Table('aaa', {
//     a: {} as Type<string>
// })

// type A = TableRecord<typeof a>
