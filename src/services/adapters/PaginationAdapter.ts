import {
  type PaginationOptions,
  type PaginationAdapterInstance,
} from "./types";
import { get, merge, set, isNil, isArray, isString } from "lodash-es";

export interface PaginationAdapterConfig extends Omit<
  PaginationOptions,
  "target"
> {}

export default class PaginationAdapter implements PaginationAdapterInstance {
  readonly config: Required<PaginationAdapterConfig>;

  constructor(config?: Partial<PaginationAdapterConfig>) {
    this.config = merge(
      {
        offset: "offset",
        total: "total",
        limit: "limit",
        previous: "previous",
        next: "next",
      },
      config
    );
  }

  async paginate<TResponse>(
    response: TResponse,
    target: string | PaginationOptions,
    page: (url: string) => Promise<{
      response: TResponse;
      pagination?: string | PaginationOptions;
    }>
  ): Promise<TResponse> {
    let fields: Required<PaginationOptions> = merge(
      {},
      this.config,
      isString(target) ? { target } : target
    );

    const result = merge({}, response);
    const dest = fields.target;

    let list = get(response, fields.target);
    let next = get(response, fields.next);

    if (isNil(next) || !isArray(list)) return response;

    while (next) {
      const { response: payload, pagination } = await page(next);
      fields = merge({}, fields, pagination);
      const patch = get(payload, fields.target, []) as unknown[];
      list = [...list, ...patch];
      next = get(payload, fields.next);
    }

    set(result, dest, list);

    return result;
  }
}
