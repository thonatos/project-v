// import { gql } from '@apollo/client/index.js';

// const queryAppConfigDoc = gql`
//   query queryAppConfig {
//     strategies(offset: 0, limit: 20, where: {}) {
//       id
//       title
//       description
//       thumb
//       url
//     }
//     referral_links(offset: 0, limit: 20, where: {}) {
//       id
//       title
//       description
//       thumb
//       url
//     }
//     sponsor_accounts(offset: 0, limit: 20, where: {}) {
//       id
//       network
//       chain_id
//       symbol
//       address
//       values
//     }
//   }
// `;

// export const queryAppConfig = {
//   operationName: 'queryAppConfig',
//   query: queryAppConfigDoc?.loc?.source.body,
//   variables: {},
// };
