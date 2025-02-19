import type { ApiNetwork } from '../../../types';
import type { ApiTransactionExtra } from '../types';

import {
  TONCOIN,
  TONHTTPAPI_V3_MAINNET_API_URL,
  TONHTTPAPI_V3_TESTNET_API_URL,
} from '../../../../config';
import { fetchJson } from '../../../../util/fetch';
import { omitUndefined, split } from '../../../../util/iteratees';
import { getEnvironment } from '../../../environment';
import { stringifyTxId } from './index';
import { toBase64Address } from './tonCore';

type AddressBook = Record<string, { user_friendly: string }>;

const ADDRESS_BOOK_CHUNK_SIZE = 128;

export async function fetchTransactions(options: {
  network: ApiNetwork;
  address: string | string[];
  limit: number;
  fromTimestamp?: number;
  toTimestamp?: number;
  shouldIncludeFrom?: boolean;
  shouldIncludeTo?: boolean;
}): Promise<ApiTransactionExtra[]> {
  const {
    network, address, limit, toTimestamp, fromTimestamp,
    shouldIncludeFrom, shouldIncludeTo,
  } = options;

  const data: {
    transactions: any[];
    address_book: AddressBook;
  } = await callApiV3(network, '/transactions', {
    account: address,
    limit,
    start_utime: fromTimestamp && msToSec(fromTimestamp) + (!shouldIncludeFrom ? 1 : 0),
    end_utime: toTimestamp && msToSec(toTimestamp) - (!shouldIncludeTo ? 1 : 0),
    sort: 'desc',
  });

  const { transactions: rawTransactions, address_book: addressBook } = data;

  if (!rawTransactions.length) {
    return [];
  }

  return rawTransactions
    .map((rawTx) => parseRawTransaction(network, rawTx, addressBook))
    .flat();
}

function parseRawTransaction(network: ApiNetwork, rawTx: any, addressBook: AddressBook): ApiTransactionExtra[] {
  const {
    now,
    lt,
    hash,
    total_fees: fee,
    description: {
      compute_ph: {
        exit_code: exitCode,
      },
    },
  } = rawTx;

  const txId = stringifyTxId({ lt, hash });
  const timestamp = now as number * 1000;
  const isIncoming = !!rawTx.in_msg.source;
  const inMsgHash = rawTx.in_msg.hash;
  const msgs: any[] = isIncoming ? [rawTx.in_msg] : rawTx.out_msgs;

  if (!msgs.length) return [];

  return msgs.map((msg, i) => {
    const { source, destination, value } = msg;
    const fromAddress = addressBook[source].user_friendly;
    const toAddress = addressBook[destination].user_friendly;
    const normalizedAddress = toBase64Address(isIncoming ? source : destination, true, network);

    return omitUndefined({
      txId: msgs.length > 1 ? `${txId}:${i + 1}` : txId,
      timestamp,
      isIncoming,
      fromAddress,
      toAddress,
      amount: isIncoming ? BigInt(value) : -BigInt(value),
      slug: TONCOIN.slug,
      fee: BigInt(fee),
      inMsgHash,
      normalizedAddress,
      shouldHide: exitCode ? true : undefined,
      extraData: {
        body: getRawBody(msg),
      },
    });
  });
}

export async function fetchLatestTxId(network: ApiNetwork, address: string): Promise<string | undefined> {
  const { transactions }: { transactions: any[] } = await callApiV3(network, '/transactions', {
    account: address,
    limit: 1,
    sort: 'desc',
  });

  if (!transactions.length) {
    return undefined;
  }

  const { lt, hash } = transactions[0];

  return stringifyTxId({ lt, hash });
}

function getRawBody(msg: any) {
  if (!msg.message_content) return undefined;
  return msg.message_content.body;
}

export async function fetchAddressBook(network: ApiNetwork, addresses: string[]): Promise<AddressBook> {
  const chunks = split(addresses, ADDRESS_BOOK_CHUNK_SIZE);

  const results = await Promise.all(chunks.map((chunk) => {
    return callApiV3(network, '/addressBook', {
      address: chunk,
    });
  }));

  return results.reduce((acc, value) => {
    return Object.assign(acc, value);
  }, {} as AddressBook);
}

export async function fixAddressFormat(network: ApiNetwork, address: string): Promise<string> {
  const result: { address_book: Record<string, string> } = await callApiV3(network, '/addressBook', { address });
  return result.address_book[address];
}

function callApiV3(network: ApiNetwork, path: string, data?: AnyLiteral) {
  const { apiHeaders, tonhttpapiMainnetKey, tonhttpapiTestnetKey } = getEnvironment();
  const baseUrl = network === 'testnet' ? TONHTTPAPI_V3_TESTNET_API_URL : TONHTTPAPI_V3_MAINNET_API_URL;
  const apiKey = network === 'testnet' ? tonhttpapiTestnetKey : tonhttpapiMainnetKey;

  return fetchJson(`${baseUrl}${path}`, data, {
    headers: {
      ...(apiKey && { 'X-Api-Key': apiKey }),
      ...apiHeaders,
    },
  });
}

function msToSec(ms: number) {
  return Math.floor(ms / 1000);
}
