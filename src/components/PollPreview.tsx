import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ImageOff, X } from 'lucide-react'

/**
 * How a poll's image and description look: the image takes the top 75% of the pop-up and the description starts below it.
 * The whole pop-up scrolls as one, so a long description is always shown in full, as typed (line breaks and spacing kept).
 */
export default function PollPreview({ image, description, onClose }: { image: string; description: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    /* while the pop-up is open the page behind stands still: it does not scroll and its animations pause, so scrolling the pop-up stays smooth */
    document.body.classList.add('pv-open')
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.classList.remove('pv-open')
    }
  }, [onClose])

  /* drawn straight into the page: inside a card with a blurred background, a fixed pop-up would be cut to the card's size */
  return createPortal(
    <div className="pvbackdrop" onClick={onClose}>
      <div className="pvmodal" role="dialog" aria-modal="true" aria-label="Poll preview" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pvmodal__close" onClick={onClose} aria-label="Close preview">
          <X size={18} />
        </button>
        <div className="pvmodal__scroll">
          <div className="pvmodal__image">
            {image ? (
              <img src={image} alt="Poll" decoding="async" />
            ) : (
              <span className="pvmodal__none">
                <ImageOff size={28} />
                No image added
              </span>
            )}
          </div>
          <div className="pvmodal__text">{description.trim() ? description : <span className="pvmodal__none">No description added</span>}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
