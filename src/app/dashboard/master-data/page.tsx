import { Metadata } from "next"
import MasterDataWrapper from "./MasterDataWrapper"

export const metadata: Metadata = {
  title: "Master Data | Berkat Jaya",
}

export default function MasterDataPage() {
  return <MasterDataWrapper />
}
