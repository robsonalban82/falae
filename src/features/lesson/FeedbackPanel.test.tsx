import { render, screen } from '@testing-library/react';
import { FeedbackPanel } from './FeedbackPanel';

describe('FeedbackPanel', () => {
  it('"almost" highlights the differing letter for sight and screen readers', () => {
    render(
      <FeedbackPanel
        grade={{ verdict: 'almost', correctAnswer: 'Good afternoon!', note: 'typo' }}
        answerLang="en"
        praise="Boa!"
        userAnswer="good afternon"
        onContinue={() => {}}
      />,
    );
    const mark = document.querySelector('mark');
    expect(mark).toHaveTextContent('o (letra diferente)');
    expect(screen.getByText(/Quase!/)).toBeInTheDocument();
  });

  it('a wrong answer shows the right one without highlights', () => {
    render(
      <FeedbackPanel
        grade={{ verdict: 'wrong', correctAnswer: 'bye' }}
        answerLang="en"
        praise="Boa!"
        userAnswer="hi"
        onContinue={() => {}}
      />,
    );
    expect(document.querySelector('mark')).toBeNull();
    expect(screen.getByText('bye')).toBeInTheDocument();
  });
});
