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
      avatarUrl
    }
  }
`

export const GET_USER_PROFILE = gql`
  query GetUserProfile($userId: ID!) {
    getUserProfile(userId: $userId) {
      id
      nama
      email
      role
      profile {
        user_id
        full_name
        phone_number
        avatarUrl
      }
    }
  }
`

export const GET_MY_ADDRESSES = gql`
  query GetMyAddresses {
    myAddresses {
      id
      user_id
      label
      recipient_name
      recipient_phone
      street
      city
      province
      is_primary
    }
  }
`

export const UPDATE_PROFILE = gql`
  mutation UpdateProfile(
    $nama: String
    $email: String
    $phoneNumber: String
  ) {
    updateProfile(
      nama: $nama
      email: $email
      phoneNumber: $phoneNumber
    ) {
      id
      nama
      email
      role
      isActive
      statusLabel
    }
  }
`

export const ADD_ADDRESS = gql`
  mutation AddAddress(
    $label: String!
    $recipientName: String!
    $recipientPhone: String
    $street: String!
    $city: String!
    $province: String!
  ) {
    addAddress(
      label: $label
      recipientName: $recipientName
      recipientPhone: $recipientPhone
      street: $street
      city: $city
      province: $province
    ) {
      id
      label
      recipient_name
      recipient_phone
      street
      city
      province
      is_primary
    }
  }
`

export const UPDATE_ADDRESS = gql`
  mutation UpdateAddress(
    $id: ID!
    $label: String!
    $recipientName: String!
    $recipientPhone: String
    $street: String!
    $city: String!
    $province: String!
  ) {
    updateAddress(
      id: $id
      label: $label
      recipientName: $recipientName
      recipientPhone: $recipientPhone
      street: $street
      city: $city
      province: $province
    ) {
      id
      label
      recipient_name
      recipient_phone
      street
      city
      province
      is_primary
    }
  }
`

export const DELETE_ADDRESS = gql`
  mutation DeleteAddress($id: ID!) {
    deleteAddress(id: $id)
  }
`

export const SET_PRIMARY_ADDRESS = gql`
  mutation SetPrimaryAddress($id: ID!) {
    setPrimaryAddress(id: $id) {
      id
      is_primary
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