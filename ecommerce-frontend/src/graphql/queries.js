import { gql } from '@apollo/client'

export const GET_PRODUCTS = gql`
  query GetProducts {
    getProducts {
      id
      namaProduk
      harga
      stok
      berat
      description
      category
    }
  }
`

export const ADD_PRODUCT = gql`
  mutation AddProduct($input: ProductInput!) {
    addProduct(input: $input) {
      id
      namaProduk
      harga
      stok
      berat
      description
      category
    }
  }
`
