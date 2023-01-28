import * as ss58 from '@subsquid/ss58'
import {lookupArchive} from '@subsquid/archive-registry'
import {decodeHex, SubstrateBatchProcessor} from '@subsquid/substrate-processor'
import {Database} from '@subsquid/file-store'
import {BalancesTransferEvent} from './types/events'
import {Extrinsics, Transfers} from './tables'

const processor = new SubstrateBatchProcessor()
    .setDataSource({
        archive: lookupArchive('kusama', {release: 'FireSquid'}),
    })
    .addEvent('Balances.Transfer', {
        data: {
            event: {
                args: true,
                extrinsic: {
                    hash: true,
                    call: {
                        origin: true,
                    },
                },
            },
        },
    } as const)

let db = new Database({
    tables: [Transfers, Extrinsics],
    dest: `./data`,
    chunkSizeMb: 10,
    syncIntervalBlocks: 1_000,
    hooks: {
        async onConnect(fs) {
            if (await fs.exists('./status.json')) {
                let status = await fs.readFile('./status.json').then(JSON.parse)
                return status.height
            } else {
                return -1
            }
        },
        async onFlush(fs, height) {
            await fs.writeFile('./status.json', JSON.stringify({height, timestamp: new Date()}))
        },
    },
})

processor.run(db, async (ctx) => {
    for (let block of ctx.blocks) {
        let prevExtrinsic: string | undefined
        for (let item of block.items) {
            if (item.name == 'Balances.Transfer') {
                let e = new BalancesTransferEvent(ctx, item.event)
                let rec: {from: Uint8Array; to: Uint8Array; amount: bigint}
                if (e.isV1020) {
                    let [from, to, amount] = e.asV1020
                    rec = {from, to, amount}
                } else if (e.isV1050) {
                    let [from, to, amount] = e.asV1050
                    rec = {from, to, amount}
                } else if (e.isV9130) {
                    rec = e.asV9130
                } else {
                    throw new Error('Unsupported spec')
                }

                ctx.store.write(Transfers, {
                    blockNumber: block.header.height,
                    timestamp: new Date(block.header.timestamp),
                    extrinsicHash: item.event.extrinsic?.hash,
                    from: ss58.codec('kusama').encode(rec.from),
                    to: ss58.codec('kusama').encode(rec.to),
                    amount: rec.amount,
                })

                if (item.event.extrinsic && prevExtrinsic != item.event.extrinsic.hash) {
                    let signer = getOriginAccountId(item.event.extrinsic.call.origin)

                    if (signer) {
                        ctx.store.write(Extrinsics, {
                            blockNumber: block.header.height,
                            timestamp: new Date(block.header.timestamp),
                            hash: item.event.extrinsic.hash,
                            signer: ss58.codec('kusama').encode(signer),
                        })
                    }
                }
            }
        }
    }
})

export function getOriginAccountId(origin: any) {
    if (origin && origin.__kind === 'system' && origin.value.__kind === 'Signed') {
        const id = origin.value.value
        if (id.__kind === 'Id') {
            return decodeHex(id.value)
        } else {
            return decodeHex(id)
        }
    } else {
        return undefined
    }
}
