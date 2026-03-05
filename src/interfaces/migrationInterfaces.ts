export type Product =
  | 'jss-to-jss'
  | 'jss-to-content-sdk'
  | 'content-sdk-to-content-sdk';

export interface MigrationSelection {
  product: Product;
  fromVersion: string;
  toVersion: string;
}
