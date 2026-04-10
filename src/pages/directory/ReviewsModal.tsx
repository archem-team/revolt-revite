import { useState } from "preact/hooks";
import type { Community, Review } from "./types";
import { bk } from "./stylesLayout";
import { Stars } from "./stylesCommunity";
import {
    Overlay, ModalBox, DragHandle, ModalHead, ModalClose, ModalBody,
    FormGroup, PrimaryBtn, ErrorMsg, SuccessMsg, RevCard, RevMeta,
} from "./stylesModal";
import { StarRating, StarPicker } from "./CommunityCard";

export function ReviewsModal({
    community, reviews, onClose, onSubmit,
}: {
    community: Community;
    reviews: Review[];
    onClose: () => void;
    onSubmit: (r: Omit<Review, "id" | "date">) => void;
}) {
    const [name, setName] = useState("");
    const [rating, setRating] = useState(5);
    const [text, setText] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    function handleSubmit(e: Event) {
        e.preventDefault();
        if (!name.trim() || !text.trim()) { setError("Name and review text are required."); return; }
        onSubmit({ vendorId: community.id, vendorType: community.type, reviewerName: name.trim(), rating, text: text.trim() });
        setSubmitted(true);
    }

    return (
        <Overlay onClick={onClose}>
            <ModalBox onClick={(e) => e.stopPropagation()}>
                <DragHandle />
                <ModalHead>
                    <div>
                        <h2>{community.name}</h2>
                        <StarRating rating={community.rating} />
                    </div>
                    <ModalClose onClick={onClose}>✕</ModalClose>
                </ModalHead>
                <ModalBody>
                    <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13, color: "var(--secondary-foreground)" }}>
                        Community Reviews ({reviews.length})
                    </div>

                    {reviews.length === 0
                        ? <div style={{ color: "var(--tertiary-foreground)", fontSize: 13, padding: "8px 0" }}>
                            No reviews yet — be the first!
                        </div>
                        : reviews.map((r) => (
                            <RevCard key={r.id}>
                                <RevMeta>
                                    <Stars style={{ fontSize: 11 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</Stars>
                                    <span className="name">{r.reviewerName}</span>
                                    <span className="date">{r.date}</span>
                                </RevMeta>
                                <div style={{ fontSize: 13, color: "var(--secondary-foreground)", lineHeight: 1.5 }}>{r.text}</div>
                            </RevCard>
                        ))
                    }

                    <div style={{ marginTop: 20, borderTop: `1px solid ${bk(0.06)}`, paddingTop: 18 }}>
                        <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 13 }}>Leave a Review</div>
                        {submitted
                            ? <SuccessMsg>✓ Review submitted — thank you!</SuccessMsg>
                            : (
                                <form onSubmit={handleSubmit}>
                                    <FormGroup>
                                        <label>Your Name</label>
                                        <input type="text" value={name}
                                            onInput={(e) => setName((e.target as HTMLInputElement).value)}
                                            placeholder="Anonymous" />
                                    </FormGroup>
                                    <FormGroup>
                                        <label>Rating</label>
                                        <StarPicker rating={rating} onChange={setRating} />
                                    </FormGroup>
                                    <FormGroup>
                                        <label>Review</label>
                                        <textarea value={text}
                                            onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
                                            placeholder="Share your experience..." />
                                    </FormGroup>
                                    {error && <ErrorMsg>{error}</ErrorMsg>}
                                    <PrimaryBtn type="submit">Submit Review</PrimaryBtn>
                                </form>
                            )
                        }
                    </div>
                </ModalBody>
            </ModalBox>
        </Overlay>
    );
}
