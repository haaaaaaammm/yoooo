import Image from "next/image";
export default function Home() {
  return (
  <div className="bg-white m-20">
    <a href="/deathclock" className=" hover:underline text-blue-500 hover:text-blue-700 block">deathclock</a>
    <a href="https://www.instagram.com/haaaaaaaaaammmm" className=" hover:underline text-blue-500 hover:text-blue-700 block">instagram</a>
    <a href="https://x.com/haaaaaaaammmmm" className=" hover:underline text-blue-500 hover:text-blue-700 block">twitter</a>
    <Image src="/images/VISANAME.png" alt="name" width={300} height={300}/>
  </div>
  );
}
