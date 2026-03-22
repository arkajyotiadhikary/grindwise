import { AskDsaQuestionUseCase } from '@grindwise/application/use-cases/ask-dsa-question.usecase';
import {
  createMockRepo,
  createMockMessenger,
  createMockContentGen,
  createMockUser,
} from '../mocks';

describe('AskDsaQuestionUseCase', () => {
  const repo = createMockRepo();
  const messenger = createMockMessenger();
  const contentGen = createMockContentGen();
  const useCase = new AskDsaQuestionUseCase(repo, messenger, contentGen);

  beforeEach(() => jest.clearAllMocks());

  it('sends DSA answer when question is valid', async () => {
    contentGen.askDsaQuestion.mockResolvedValue({
      isDsaRelated: true,
      answer: 'A binary tree has at most two children per node.',
    });

    await useCase.execute(createMockUser(), 'What is a binary tree?');

    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('binary tree has at most two children'),
    );
    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('DSA Answer'),
    );
  });

  it('rejects non-DSA questions', async () => {
    contentGen.askDsaQuestion.mockResolvedValue({
      isDsaRelated: false,
      answer: '',
    });

    await useCase.execute(createMockUser(), 'What is the weather?');

    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("I'm a DSA tutor bot"),
    );
  });

  it('rejects when AI returns null', async () => {
    contentGen.askDsaQuestion.mockResolvedValue(null);

    await useCase.execute(createMockUser(), 'anything');

    expect(messenger.sendText).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("I'm a DSA tutor bot"),
    );
  });

  it('shows typing indicator', async () => {
    contentGen.askDsaQuestion.mockResolvedValue({ isDsaRelated: true, answer: 'ans' });
    await useCase.execute(createMockUser(), 'question');
    expect(messenger.showTyping).toHaveBeenCalled();
  });

  it('logs the response', async () => {
    contentGen.askDsaQuestion.mockResolvedValue({ isDsaRelated: true, answer: 'ans' });
    await useCase.execute(createMockUser(), 'q');
    expect(repo.logMessage).toHaveBeenCalledWith('user-1', 'outbound', 'ask', expect.any(String));
  });
});
