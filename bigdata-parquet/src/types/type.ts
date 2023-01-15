import {Type} from '@subsquid/bigdata-table'
import {DataType} from 'apache-arrow'

export interface ParquetType<T> extends Type<T> {
    getArrowDataType(): DataType
}