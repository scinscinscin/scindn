import axios from "axios";

interface Options {
  clientId: string;
  scindnDomain: string;
}

export function createScinDNClient(options: Options) {
  async function upload(link: string, files: File[]) {
    const fd = new FormData();
    for (const file of files) fd.append("files", file);

    try {
      const { data } = await axios.put(`${options.scindnDomain}${link}`, fd);
      return data as string;
    } catch (err) {
      throw new Error("Failed to upload files");
    }
  }

  return { upload };
}
