import Image from "next/image";
import Link from "next/link";
export default function Home() {
  return (
  <div className="bg-white m-20">
    <Link href="/deathclock" className=" hover:underline text-blue-500 hover:text-blue-700 block">deathclock</Link>
    <Link href="/nohaydiferenciasentreestoyunpoemario" className=" hover:underline text-blue-500 hover:text-blue-700 block">no hay diferencias entre esto y un poemario</Link>
    <Link href="/archivo" className=" hover:underline text-blue-500 hover:text-blue-700 block">archivo</Link>
    <Image src="/images/VISANAME.png" alt="name" width={300} height={300}/>
  </div>
  );
}
