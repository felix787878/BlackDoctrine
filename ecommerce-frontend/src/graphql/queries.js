import { gql } from '@apollo/client'
import { userClient, productClient } from './apolloClient'

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

export const GET_ME = gql`
  query GetMe {
    me {
      id
      nama
      email
      role
      isActive
      statusLabel
    }
  }
`

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile($nama: String, $email: String) {
    updateProfile(nama: $nama, email: $email) {
      id
      nama
      email
      role
      isActive
      statusLabel
    }
  }
`

export const CHANGE_PASSWORD = gql`
  mutation ChangePassword($oldPass: String!, $newPass: String!) {
    changePassword(oldPass: $oldPass, newPass: $newPass)
  }
`

export const SOFT_DELETE_ACCOUNT = gql`
  mutation SoftDeleteAccount {
    softDeleteAccount
  }
`