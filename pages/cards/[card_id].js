import { useRouter } from 'next/router'

export default function Card() {
  const router = useRouter()
  const { card_id } = router.query

  return (
    <div>
      <h1>Card: {card_id}</h1>
    </div>
  )
}